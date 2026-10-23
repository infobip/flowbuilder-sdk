/*
 * Copyright 2026 INFOBIP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Editor state hook for Flow Builder.
//
// Owns the create/edit lifecycle for the editor: loading an existing flow,
// generating from prompt text, saving JSON/title edits, refreshing the live
// preview, publishing, deleting, and the small bits of UI state that sit around
// those network calls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiOptions } from '../../api';
import { useApiConfig } from '../app/apiConfig';
import {
  createFlow,
  deleteFlow as deleteFlowRequest,
  downloadFlowJson,
  generateFlow,
  getFlow,
  publishFlow as publishFlowRequest,
  replaceFlowDefinition,
  type ManagedFlow,
  updateFlow as updateFlowMetadata,
  uploadFlowJson,
} from '../../services/whatsappFlows';
import {
  buildFlowName,
  formatFlowJson,
  isWhatsAppFlow,
  normalizeValidationErrors,
  splitFlowName,
  type FlowCategory,
  type FlowValidationError,
  type WhatsAppFlow as SharedWhatsAppFlow,
} from '../../shared';
import {
  applyPngUploadToDraft,
  FileReadError,
  readFileAsBase64,
  validatePngFile,
} from '../../flowJsonDraft';
import { validateFlow } from '../../../src/validators/flow-validator';
import type { WhatsAppFlow as ValidatedWhatsAppFlow } from '../../../src/types/flow';
import { fetchFlowPreview, IDLE_PREVIEW, type FlowPreviewState } from '../services/flowPreview';
import {
  buildEditorFlowName,
  deriveEditorTitleFromPrompt,
  getEditorStarterChoices,
  normalizeEditorTitle,
  type EditorGenerationStatus,
} from '../utils/editor';
import { retryTransientFlowLoad } from '../utils/flowLoad';
import {
  canDeleteEditorFlow,
  canFixEditorErrors,
  canPublishEditorFlow,
  canSaveEditorDraft,
  hasEditorUnsavedChanges,
  hasSaveableEditorChanges,
} from '../utils/lifecycle';
import type { EditorMode } from '../utils/routing';
import { useFlowSyncBus, useInstanceStorage, useNavigate } from '../app/instanceContext';
import { useI18n, type Translate } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';
import type { InstanceStorage } from '../services/storage';
import { parseJsonDraft } from '../utils/jsonEditor';
import {
  buildAssistantMessage,
  buildErrorMessage,
  buildPendingMessage,
  buildUserMessage,
  replaceMessage,
  summarizeFlow,
  type EditorChatMessage,
} from '../utils/chatMessages';
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../services/chatHistory';
import {
  collectImageUploadSlots,
  isImageUploadSlotAvailable,
  type ImageUploadSlot,
} from '../utils/imageUploads';

// Outcome of a generate turn, used to drive the chat transcript's assistant/error reply.
type GenerationResult =
  | { ok: true; flow: SharedWhatsAppFlow; action: 'created' | 'updated' }
  | { ok: false; error: string }
  | null;

type DraftSyncResult =
  | { ok: true }
  | { ok: false; error: string | null };

function toValidatedFlow(flow: SharedWhatsAppFlow): ValidatedWhatsAppFlow {
  return flow as unknown as ValidatedWhatsAppFlow;
}

function validateSharedFlow(flow: SharedWhatsAppFlow): FlowValidationError[] {
  return normalizeValidationErrors(validateFlow(toValidatedFlow(flow)).errors as unknown) as FlowValidationError[];
}

const DEFAULT_CATEGORY: FlowCategory = 'OTHER';

export type EditorState = {
  loading: boolean;
  error: string | null;
  flow: ManagedFlow | null;
  title: string;
  setTitle: (value: string) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  imageUploadSlots: ImageUploadSlot[];
  imageUploadBusySlotKey: string | null;
  imageUploadError: string | null;
  uploadJsonImage: (slot: ImageUploadSlot, file: File) => Promise<void>;
  jsonDraft: string;
  setJsonDraft: (value: string) => void;
  jsonError: string | null;
  isDirty: boolean;
  hasPersistableChanges: boolean;
  canSaveDraft: boolean;
  canPublish: boolean;
  canDelete: boolean;
  generationStatus: EditorGenerationStatus;
  generationMessage: string | null;
  generationError: string | null;
  saveBusy: boolean;
  saveError: string | null;
  publishBusy: boolean;
  publishError: string | null;
  deleteBusy: boolean;
  deleteError: string | null;
  validationErrors: FlowValidationError[];
  canFixErrors: boolean;
  fixErrors: () => void;
  preview: FlowPreviewState;
  favorite: boolean;
  toggleFavorite: () => void;
  messages: EditorChatMessage[];
  submitPrompt: () => void;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  remove: () => Promise<void>;
  reload: () => void;
  updatePreview: () => Promise<void>;
  promptSuggestions: ReturnType<typeof getEditorStarterChoices>;
};

function extractFlow(raw: unknown): SharedWhatsAppFlow | null {
  if (isWhatsAppFlow(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const candidate = (raw as { flow?: unknown }).flow;
    if (isWhatsAppFlow(candidate)) return candidate;
  }
  return null;
}

function parseFlowDraft(value: string, t: Translate): { flow: SharedWhatsAppFlow | null; error: string | null } {
  const parsed = parseJsonDraft(value, t);
  if (!parsed.value) {
    return { flow: null, error: parsed.error };
  }
  if (!isWhatsAppFlow(parsed.value)) {
    return { flow: null, error: t('notices.errors.flowShape') };
  }
  return { flow: parsed.value, error: null };
}

// Favourites live in the instance's storage under `favorites` (by default
// localStorage's `flowbuilder_favorites`), as a JSON array of flow ids.
function parseFavoriteIds(storage: InstanceStorage): Set<string> {
  try {
    const raw = storage.read('favorites');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0));
  } catch {
    return new Set();
  }
}

function readFavorite(storage: InstanceStorage, flowId: string | null): boolean {
  if (!flowId) return false;
  return parseFavoriteIds(storage).has(flowId);
}

// Storage failures are ignored: the star still toggles for this session.
function writeFavorite(storage: InstanceStorage, flowId: string, favorite: boolean): void {
  const next = parseFavoriteIds(storage);
  if (favorite) next.add(flowId);
  else next.delete(flowId);
  storage.write('favorites', JSON.stringify(Array.from(next)));
}

function makeManagedFlow(params: {
  id: string;
  name: string;
  status: ManagedFlow['status'];
  categories: FlowCategory[];
  updatedAt?: string | null;
}): ManagedFlow {
  const parsed = splitFlowName(params.name);
  return {
    id: params.id,
    name: params.name,
    displayName: parsed.displayName,
    responseId: parsed.responseId,
    status: params.status,
    categories: params.categories,
    updatedAt: params.updatedAt ?? null,
  };
}

// Sent to the model, not shown to the user, and it names Infobip's API: it is
// intentionally not translated.
function buildFixPrompt(errors: FlowValidationError[]): string {
  return [
    'The generated WhatsApp Flow has the following validation errors returned by the Infobip API.',
    'Fix every one of them and return a corrected flow that preserves the original intent and structure.',
    '',
    'Validation errors:',
    JSON.stringify(errors, null, 2),
  ].join('\n');
}

function flowToManaged(params: {
  id: string;
  name: string;
  status: ManagedFlow['status'];
  categories: FlowCategory[];
  updatedAt?: string | null;
}): ManagedFlow {
  return makeManagedFlow(params);
}

function toSyncFlow(flow: ManagedFlow): { id: string; name: string; status: ManagedFlow['status']; categories: FlowCategory[]; updatedAt?: string | null } {
  return {
    id: flow.id,
    name: flow.name,
    status: flow.status,
    categories: flow.categories,
    updatedAt: flow.updatedAt ?? null,
  };
}

export function useEditorFlow(flowId: string | null, mode: EditorMode): EditorState {
  const apiOptions: ApiOptions = useApiConfig();
  const navigate = useNavigate();
  const syncBus = useFlowSyncBus();
  const storage = useInstanceStorage();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(flowId != null);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<ManagedFlow | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageUploadBusySlotKey, setImageUploadBusySlotKey] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<EditorGenerationStatus>('idle');
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<FlowValidationError[]>([]);
  const [preview, setPreview] = useState<FlowPreviewState>(IDLE_PREVIEW);
  const [favorite, setFavorite] = useState(() => readFavorite(storage, flowId));
  const [previewSyncBusy, setPreviewSyncBusy] = useState(false);
  const [messages, setMessagesState] = useState<EditorChatMessage[]>(() => loadChatHistory(storage, flowId));
  const messagesRef = useRef<EditorChatMessage[]>(messages);
  const setMessages = useCallback(
    (
      next: EditorChatMessage[] | ((current: EditorChatMessage[]) => EditorChatMessage[]),
    ) => {
      setMessagesState((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        messagesRef.current = resolved;
        return resolved;
      });
    },
    [],
  );

  // The flow id the in-memory `messages` currently belong to. Guards the persist
  // effect so a transcript is never written under a flow it wasn't loaded for
  // (e.g. mid-switch between two flows).
  const messagesFlowIdRef = useRef<string | null>(flowId);
  // Id of the in-flight `pending` chat placeholder awaiting a generate result.
  const pendingChatIdRef = useRef<string | null>(null);

  const loadControllerRef = useRef<AbortController | null>(null);
  const previewControllerRef = useRef<AbortController | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);
  const jsonSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jsonSyncControllerRef = useRef<AbortController | null>(null);
  const initialFlowIdRef = useRef(flowId);
  const skipNextLoadRef = useRef<string | null>(null);
  const baselineTitleRef = useRef('');
  const baselinePromptRef = useRef('');
  const baselineJsonRef = useRef('');
  const flowRef = useRef<ManagedFlow | null>(null);
  const jsonDraftRef = useRef(jsonDraft);
  const previewRef = useRef(preview);
  const skipNextJsonSyncRef = useRef<string | null>(null);
  flowRef.current = flow;
  jsonDraftRef.current = jsonDraft;
  previewRef.current = preview;

  const setPreviewWithCleanup = useCallback((nextPreview: FlowPreviewState) => {
    setPreview((current) => {
      if (current.kind === 'image' && current.url.startsWith('blob:')) {
        URL.revokeObjectURL(current.url);
      }
      return nextPreview;
    });
  }, []);

  const beginPreviewLoad = useCallback(() => {
    setPreview((current) => ({ ...current, status: 'loading', error: null }));
  }, []);

  const cancelJsonSync = useCallback(() => {
    const hadPendingSync = jsonSyncControllerRef.current !== null || jsonSyncTimerRef.current !== null;
    jsonSyncControllerRef.current?.abort();
    jsonSyncControllerRef.current = null;
    if (jsonSyncTimerRef.current) {
      clearTimeout(jsonSyncTimerRef.current);
      jsonSyncTimerRef.current = null;
    }
    if (hadPendingSync) setPreviewSyncBusy(false);
  }, []);

  const runPreview = useCallback(async (targetFlowId: string, signal?: AbortSignal) => {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (!effectiveSignal) return;

    if (controller) {
      previewControllerRef.current?.abort();
      previewControllerRef.current = controller;
    }

    beginPreviewLoad();

    try {
      const result = await fetchFlowPreview(targetFlowId, { ...apiOptions, signal: effectiveSignal }, t);
      if (!effectiveSignal.aborted) {
        setPreviewWithCleanup(result);
      }
    } catch (error) {
      if (effectiveSignal.aborted) return;
      setPreviewWithCleanup({
        status: 'error',
        kind: null,
        url: '',
        error: describeError(t, error, 'preview.errors.unavailable'),
        expiresAt: null,
      });
    }
  }, [apiOptions, beginPreviewLoad, setPreviewWithCleanup, t]);

  const applyLoadedState = useCallback((nextFlow: ManagedFlow, nextJson: SharedWhatsAppFlow | null) => {
    const formattedJson = nextJson ? formatFlowJson(nextJson) : '';
    setFlow(nextFlow);
    setTitle(nextFlow.displayName);
    setPrompt('');
    setImageUploadBusySlotKey(null);
    setImageUploadError(null);
    skipNextJsonSyncRef.current = null;
    setJsonDraft(formattedJson);
    setJsonError(null);
    setValidationErrors(nextJson ? validateSharedFlow(nextJson) : []);
    setFavorite(readFavorite(storage, nextFlow.id));
    messagesFlowIdRef.current = nextFlow.id;
    setMessages(loadChatHistory(storage, nextFlow.id));
    setError(null);
    baselineTitleRef.current = nextFlow.displayName;
    baselinePromptRef.current = '';
    baselineJsonRef.current = formattedJson;
  }, [storage]);

  const resetBlankState = useCallback(() => {
    setLoading(false);
    setError(null);
    setFlow(null);
    setTitle('');
    setPrompt('');
    setImageUploadBusySlotKey(null);
    setImageUploadError(null);
    skipNextJsonSyncRef.current = null;
    setJsonDraft('');
    setJsonError(null);
    setGenerationStatus('idle');
    setGenerationMessage(null);
    setGenerationError(null);
    setSaveError(null);
    setPublishError(null);
    setDeleteError(null);
    setValidationErrors([]);
    setPreviewWithCleanup(IDLE_PREVIEW);
    setFavorite(false);
    messagesFlowIdRef.current = null;
    pendingChatIdRef.current = null;
    setMessages([]);
    baselineTitleRef.current = '';
    baselinePromptRef.current = '';
    baselineJsonRef.current = '';
  }, [setPreviewWithCleanup]);

  const reload = useCallback(() => {
    loadControllerRef.current?.abort();
    cancelJsonSync();

    if (flowId == null) {
      skipNextLoadRef.current = null;
      resetBlankState();
      return;
    }

    if (skipNextLoadRef.current === flowId) {
      skipNextLoadRef.current = null;
      void runPreview(flowId);
      return;
    }

    const controller = new AbortController();
    loadControllerRef.current = controller;
    setLoading(true);
    setError(null);

    void retryTransientFlowLoad(async () => {
      const [meta, rawJson] = await Promise.all([
        getFlow(flowId, { ...apiOptions, signal: controller.signal }),
        downloadFlowJson(flowId, { ...apiOptions, signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      const parsedFlow = extractFlow(rawJson);
      const nextFlow = flowToManaged({
        id: meta.id,
        name: meta.name || buildFlowName(meta.displayName, meta.responseId),
        status: meta.status,
        categories: meta.categories,
        updatedAt: meta.updatedAt ?? null,
      });
      applyLoadedState(nextFlow, parsedFlow);
      setTitle(nextFlow.displayName);
      skipNextLoadRef.current = nextFlow.id;
      void runPreview(meta.id);
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) {
        setError(describeError(t, err, 'notices.errors.loadFailed'));
        setFlow(null);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  }, [apiOptions, applyLoadedState, cancelJsonSync, flowId, resetBlankState, runPreview, t]);

  useEffect(() => {
    reload();
    return () => {
      loadControllerRef.current?.abort();
      previewControllerRef.current?.abort();
      generationControllerRef.current?.abort();
      jsonSyncControllerRef.current?.abort();
      if (jsonSyncTimerRef.current) clearTimeout(jsonSyncTimerRef.current);
      if (previewRef.current.kind === 'image' && previewRef.current.url.startsWith('blob:')) {
        URL.revokeObjectURL(previewRef.current.url);
      }
    };
  }, [reload]);

  // Persist the transcript whenever it changes, but only under the flow it was
  // loaded/generated for. A freshly created flow keeps this mounted component
  // (the create navigation is short-circuited by `skipNextLoadRef`), so the
  // in-memory messages survive the `flows/new → flows/:id` transition and land
  // under the new id here automatically.
  useEffect(() => {
    const id = flow?.id;
    if (!id || messagesFlowIdRef.current !== id) return;
    saveChatHistory(storage, id, messages);
  }, [messages, flow?.id, storage]);

  const isDirty = useMemo(() => hasEditorUnsavedChanges({
    hasFlow: flow != null,
    title,
    baselineTitle: baselineTitleRef.current,
    prompt,
    baselinePrompt: baselinePromptRef.current,
    jsonDraft,
    baselineJson: baselineJsonRef.current,
  }), [flow, jsonDraft, prompt, title]);

  // Not memoised: the baselines are refs that a save moves without changing `title` or `jsonDraft`,
  // so a memo on those two would stay true after saving an unchanged title and keep Publish disabled.
  const hasPersistableChanges = hasSaveableEditorChanges({
    title,
    baselineTitle: baselineTitleRef.current,
    jsonDraft,
    baselineJson: baselineJsonRef.current,
  });

  const imageUploadSlots = useMemo(
    () => collectImageUploadSlots(jsonDraft),
    [jsonDraft],
  );
  const imageUploadBusy = imageUploadBusySlotKey !== null;

  const canFixErrors = canFixEditorErrors({
    hasFlow: flow != null,
    validationErrorCount: validationErrors.length,
    hasJsonError: jsonError != null,
    busy: generationStatus === 'submitting' || generationStatus === 'generating' || saveBusy || publishBusy || deleteBusy || imageUploadBusy,
  });

  const canDelete = canDeleteEditorFlow({
    hasFlow: flow != null,
    flowStatus: flow?.status ?? 'none',
    busy: deleteBusy || previewSyncBusy || imageUploadBusy,
  });

  const canSaveDraft = canSaveEditorDraft({
    hasFlow: flow != null,
    hasJsonError: jsonError != null,
    busy: saveBusy || publishBusy || deleteBusy || previewSyncBusy || imageUploadBusy,
    hasPersistableChanges,
  });
  const canPublish = canPublishEditorFlow({
    hasFlow: flow != null,
    flowStatus: flow?.status ?? 'none',
    hasValidationErrors: validationErrors.length > 0,
    hasJsonError: jsonError != null,
    hasPersistableChanges,
    busy: saveBusy || publishBusy || deleteBusy || previewSyncBusy || imageUploadBusy,
  });

  const persistGeneratedFlow = useCallback(async (nextFlow: SharedWhatsAppFlow, responseId: string | null, sourcePrompt: string) => {
    const current = flowRef.current;
    const currentTitle = current?.displayName ?? t('editor.untitledFlow');
    const derivedTitle = sourcePrompt ? deriveEditorTitleFromPrompt(sourcePrompt) : '';
    const baseTitle = normalizeEditorTitle(title || derivedTitle || currentTitle, t);

    if (!current) {
      const saveResult = await createFlow(
        {
          name: baseTitle,
          responseId: responseId ?? undefined,
          category: DEFAULT_CATEGORY,
          flow: nextFlow,
        },
        apiOptions,
      );
      const nextManaged = flowToManaged({
        id: saveResult.id,
        name: saveResult.name || buildFlowName(baseTitle, saveResult.responseId ?? responseId),
        status: 'DRAFT',
        categories: [DEFAULT_CATEGORY],
      });
      setFlow(nextManaged);
      setTitle(nextManaged.displayName);
      setPrompt('');
      skipNextLoadRef.current = nextManaged.id;
      messagesFlowIdRef.current = nextManaged.id;
      saveChatHistory(storage, nextManaged.id, messagesRef.current);
      setImageUploadError(null);
      setImageUploadBusySlotKey(null);
      skipNextJsonSyncRef.current = null;
      setJsonDraft(formatFlowJson(nextFlow));
      setGenerationStatus('success');
      setGenerationMessage(t('notices.success.created'));
      setGenerationError(null);
      setError(null);
      baselineTitleRef.current = nextManaged.displayName;
      baselinePromptRef.current = '';
      baselineJsonRef.current = formatFlowJson(nextFlow);
      setValidationErrors(validateSharedFlow(nextFlow));
      syncBus.publish({
        type: 'created',
        flow: toSyncFlow(nextManaged),
      });
      navigate({ name: 'flow-edit', flowId: nextManaged.id, mode });
      return nextManaged;
    }

    const updateResult = await replaceFlowDefinition(current.id, nextFlow, apiOptions);
    const nextManaged = flowToManaged({
      id: updateResult.id,
      name: buildEditorFlowName(baseTitle, t, responseId ?? current.responseId),
      status: current.status,
      categories: current.categories,
      updatedAt: current.updatedAt ?? null,
    });
    setFlow(nextManaged);
    setTitle(nextManaged.displayName);
    skipNextLoadRef.current = nextManaged.id;
    messagesFlowIdRef.current = nextManaged.id;
    saveChatHistory(storage, nextManaged.id, messagesRef.current);
    setImageUploadError(null);
    setImageUploadBusySlotKey(null);
    skipNextJsonSyncRef.current = null;
    setJsonDraft(formatFlowJson(nextFlow));
    setGenerationStatus('success');
    setGenerationMessage(t('notices.success.updated'));
    setGenerationError(null);
    setError(null);
    baselineTitleRef.current = nextManaged.displayName;
    baselineJsonRef.current = formatFlowJson(nextFlow);
    setValidationErrors(validateSharedFlow(nextFlow));
    syncBus.publish({
      type: 'updated',
      flow: toSyncFlow(nextManaged),
    });
    await runPreview(nextManaged.id);
    return nextManaged;
  }, [apiOptions, mode, navigate, runPreview, storage, syncBus, t, title]);

  const generateAndPersist = useCallback(async (promptText: string): Promise<GenerationResult> => {
    generationControllerRef.current?.abort();
    const controller = new AbortController();
    generationControllerRef.current = controller;
    const isUpdate = flowRef.current != null;
    setGenerationStatus('submitting');
    setGenerationMessage(t('notices.progress.submitting'));
    setGenerationError(null);

    try {
      setGenerationStatus('generating');
      setGenerationMessage(t('notices.progress.generating'));
      const response = await generateFlow(
        promptText,
        flowRef.current?.responseId ?? undefined,
        { ...apiOptions, signal: controller.signal },
      );
      if (controller.signal.aborted) return null;
      const nextFlow = response.flow;
      const result = validateSharedFlow(nextFlow);
      setValidationErrors(result);
      await persistGeneratedFlow(nextFlow, response.responseId ?? flowRef.current?.responseId ?? null, promptText);
      return { ok: true, flow: nextFlow, action: isUpdate ? 'updated' : 'created' };
    } catch (error) {
      if (controller.signal.aborted) return null;
      const message = describeError(t, error, 'notices.errors.generateFailed');
      setGenerationStatus('failure');
      setGenerationMessage(null);
      setGenerationError(message);
      return { ok: false, error: message };
    }
  }, [apiOptions, persistGeneratedFlow, t]);

  // Runs a generate turn wrapped in chat bookkeeping: appends the visible user
  // message + a pending placeholder, then replaces the placeholder with a plain
  // -text assistant summary (or an error) once the result lands.
  const runChatGeneration = useCallback((promptText: string, userText: string) => {
    if (generationStatus === 'submitting' || generationStatus === 'generating') return;
    const pending = buildPendingMessage(t, locale);
    pendingChatIdRef.current = pending.id;
    setMessages((prev) => [...prev, buildUserMessage(userText, locale), pending]);

    void generateAndPersist(promptText).then((result) => {
      const pendingId = pendingChatIdRef.current;
      if (result === null || !pendingId) return;
      pendingChatIdRef.current = null;
      const reply = result.ok
        ? buildAssistantMessage(summarizeFlow(result.flow, t, result.action), locale)
        : buildErrorMessage(result.error, locale);
      setMessages((prev) => replaceMessage(prev, pendingId, reply));
    });
  }, [generateAndPersist, generationStatus, locale, t]);

  const submitPrompt = useCallback(() => {
    const nextPrompt = prompt.trim();
    if (
      !nextPrompt
      || generationStatus === 'submitting'
      || generationStatus === 'generating'
      || imageUploadBusySlotKey !== null
    ) return;
    runChatGeneration(nextPrompt, nextPrompt);
    setPrompt('');
  }, [generationStatus, imageUploadBusySlotKey, prompt, runChatGeneration]);

  const syncDraftToPreview = useCallback(async (parsed: SharedWhatsAppFlow): Promise<DraftSyncResult> => {
    const current = flowRef.current;
    if (!current) return { ok: false, error: t('notices.errors.generateFirst') };

    jsonSyncControllerRef.current?.abort();
    const controller = new AbortController();
    jsonSyncControllerRef.current = controller;
    setPreviewSyncBusy(true);

    try {
      const result = await uploadFlowJson(current.id, parsed, { ...apiOptions, signal: controller.signal });
      if (controller.signal.aborted) return { ok: false, error: null };
      setValidationErrors(normalizeValidationErrors((result as { validationErrors?: unknown } | undefined)?.validationErrors));
      baselineJsonRef.current = formatFlowJson(parsed);
      await runPreview(current.id, controller.signal);
      return { ok: true };
    } catch (error) {
      if (controller.signal.aborted) return { ok: false, error: null };
      return { ok: false, error: describeError(t, error, 'notices.errors.refreshDraftFailed') };
    } finally {
      if (jsonSyncControllerRef.current === controller) {
        jsonSyncControllerRef.current = null;
        setPreviewSyncBusy(false);
      }
    }
  }, [apiOptions, runPreview, t]);

  const refreshPreviewFromDraft = useCallback(async (parsed: SharedWhatsAppFlow) => {
    setSaveError(null);
    const result = await syncDraftToPreview(parsed);
    if (!result.ok && result.error) setSaveError(result.error);
  }, [syncDraftToPreview]);

  const uploadJsonImage = useCallback(async (slot: ImageUploadSlot, file: File) => {
    if (imageUploadBusySlotKey !== null) return;
    if (!flowRef.current) {
      setImageUploadError(t('notices.errors.generateFirstUpload'));
      return;
    }

    // validatePngFile only ever rejects non-PNG files.
    if (validatePngFile(file)) {
      setImageUploadError(t('notices.errors.pngOnly'));
      return;
    }

    const draftText = jsonDraftRef.current;
    if (!isImageUploadSlotAvailable(draftText, slot)) {
      setImageUploadError(t('notices.errors.imageGone'));
      return;
    }

    setImageUploadBusySlotKey(slot.key);
    setImageUploadError(null);
    setSaveError(null);

    try {
      const base64 = await readFileAsBase64(file);
      const { nextDraftText, nextFlow } = applyPngUploadToDraft(draftText, slot, base64);
      if (!nextFlow) {
        setImageUploadError(t('notices.errors.notAValidFlow'));
        return;
      }

      const syncResult = await syncDraftToPreview(nextFlow);
      if (!syncResult.ok) {
        if (syncResult.error) setImageUploadError(syncResult.error);
        return;
      }

      // The server already has this exact draft. Suppress the JSON editor's
      // debounced sync when React publishes the patched text locally.
      skipNextJsonSyncRef.current = nextDraftText;
      jsonDraftRef.current = nextDraftText;
      setJsonDraft(nextDraftText);
      setJsonError(null);
      setImageUploadError(null);
    } catch (error) {
      setImageUploadError(error instanceof FileReadError ? t('notices.errors.fileReadFailed') : error instanceof Error && error.message ? error.message : t('notices.errors.uploadImageFailed', { number: slot.number }));
    } finally {
      setImageUploadBusySlotKey(null);
    }
  }, [imageUploadBusySlotKey, syncDraftToPreview, t]);

  useEffect(() => {
    if (!flowRef.current || mode !== 'json') return;
    if (!jsonDraft.trim()) return;
    if (skipNextLoadRef.current === flowRef.current.id) {
      skipNextLoadRef.current = null;
      return;
    }
    if (skipNextJsonSyncRef.current !== null) {
      const alreadySyncedDraft = skipNextJsonSyncRef.current;
      skipNextJsonSyncRef.current = null;
      if (alreadySyncedDraft === jsonDraft) return;
    }

    const parsed = parseFlowDraft(jsonDraft, t);
    if (!parsed.flow) {
      setJsonError(parsed.error);
      return;
    }

    setJsonError(null);
    const localErrors = validateSharedFlow(parsed.flow);
    setValidationErrors(localErrors);

    if (formatFlowJson(parsed.flow) === baselineJsonRef.current) {
      return;
    }

    cancelJsonSync();
    jsonSyncTimerRef.current = setTimeout(() => {
      void refreshPreviewFromDraft(parsed.flow as SharedWhatsAppFlow);
    }, 450);

    return () => cancelJsonSync();
  }, [cancelJsonSync, jsonDraft, mode, refreshPreviewFromDraft, t]);

  const saveDraft = useCallback(async () => {
    const current = flowRef.current;
    if (!current) {
      setSaveError(t('notices.errors.generateFirst'));
      return;
    }
    if (!hasPersistableChanges) {
      setSaveError(t('notices.errors.nothingToSave'));
      return;
    }

    const parsed = parseFlowDraft(jsonDraft, t);
    if (!parsed.flow) {
      setJsonError(parsed.error);
      setSaveError(t('notices.errors.fixJsonBeforeSaving'));
      return;
    }

    setSaveBusy(true);
    setSaveError(null);
    try {
      const nextName = buildEditorFlowName(title || current.displayName, t, current.responseId);
      const metadata = await updateFlowMetadata(current.id, {
        name: nextName,
        categories: current.categories.length > 0 ? current.categories : [DEFAULT_CATEGORY],
      }, apiOptions);
      const result = await uploadFlowJson(current.id, parsed.flow, apiOptions);
      const nextFlow = flowToManaged({
        id: metadata.id,
        name: nextName,
        status: metadata.status,
        categories: metadata.categories,
        updatedAt: metadata.updatedAt ?? current.updatedAt ?? null,
      });
      setFlow(nextFlow);
      setTitle(nextFlow.displayName);
      setGenerationStatus('success');
      setGenerationMessage(t('notices.success.draftSaved'));
      setGenerationError(null);
      setError(null);
      baselineTitleRef.current = nextFlow.displayName;
      baselineJsonRef.current = formatFlowJson(parsed.flow);
      setValidationErrors(normalizeValidationErrors((result as { validationErrors?: unknown } | undefined)?.validationErrors));
      syncBus.publish({
        type: 'updated',
        flow: toSyncFlow(nextFlow),
      });
      await runPreview(current.id);
    } catch (error) {
      setSaveError(describeError(t, error, 'notices.errors.saveFailed'));
    } finally {
      setSaveBusy(false);
    }
  }, [apiOptions, hasPersistableChanges, jsonDraft, runPreview, syncBus, t, title]);

  const publish = useCallback(async () => {
    const current = flowRef.current;
    if (!current) return;
    if (!canPublish) {
      setPublishError(
        jsonError
          ? t('notices.errors.resolveJsonError')
          : validationErrors.length > 0
            ? t('notices.errors.resolveValidationErrors')
            : current.status !== 'DRAFT'
              ? t('notices.errors.onlyDraftsPublish')
              : hasPersistableChanges
                ? t('notices.errors.saveBeforePublish')
                : t('notices.errors.publishUnavailable'),
      );
      return;
    }
    setPublishBusy(true);
    setPublishError(null);
    try {
      await publishFlowRequest(current.id, apiOptions);
      const nextFlow = { ...current, status: 'PUBLISHED' as const };
      setFlow(nextFlow);
      setGenerationStatus('success');
      setGenerationMessage(t('notices.success.published'));
      syncBus.publish({ type: 'published', flow: toSyncFlow(nextFlow) });
    } catch (error) {
      setPublishError(describeError(t, error, 'notices.errors.publishFailed'));
    } finally {
      setPublishBusy(false);
      // Always re-fetch the flow (meta + JSON + preview) so the editor reflects
      // the true backend state after a publish attempt, success or failure.
      // Clear the skip guard so this reload isn't swallowed as a redundant load.
      skipNextLoadRef.current = null;
      reload();
    }
  }, [apiOptions, canPublish, hasPersistableChanges, jsonError, reload, syncBus, t, validationErrors.length]);

  const remove = useCallback(async () => {
    const current = flowRef.current;
    if (!current) return;
    if (!canDelete) {
      setDeleteError(current.status !== 'DRAFT' ? t('notices.errors.onlyDraftsDelete') : t('notices.errors.deleteUnavailable'));
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteFlowRequest(current.id, apiOptions);
      syncBus.publish({ type: 'deleted', id: current.id });
      clearChatHistory(storage, current.id);
      setFlow(null);
      setTitle('');
      setPrompt('');
      setImageUploadBusySlotKey(null);
      setImageUploadError(null);
      skipNextJsonSyncRef.current = null;
      jsonDraftRef.current = '';
      setJsonDraft('');
      setJsonError(null);
      setValidationErrors([]);
      setPreviewWithCleanup(IDLE_PREVIEW);
      setFavorite(false);
      messagesFlowIdRef.current = null;
      pendingChatIdRef.current = null;
      setMessages([]);
      baselineTitleRef.current = '';
      baselinePromptRef.current = '';
      baselineJsonRef.current = '';
      navigate({ name: 'library' });
    } catch (error) {
      setDeleteError(describeError(t, error, 'notices.errors.deleteFailed'));
      // The backend refused the delete; re-fetch so the editor stops offering an
      // action the backend rejects (e.g. the flow is no longer DRAFT).
      // Clear the skip guard so this reload isn't swallowed as a redundant load.
      skipNextLoadRef.current = null;
      reload();
    } finally {
      setDeleteBusy(false);
    }
  }, [apiOptions, canDelete, navigate, reload, setPreviewWithCleanup, storage, syncBus, t]);

  const toggleFavorite = useCallback(() => {
    const current = flowRef.current;
    if (!current) return;
    setFavorite((previous) => {
      const next = !previous;
      writeFavorite(storage, current.id, next);
      return next;
    });
  }, [storage]);

  const fixErrors = useCallback(() => {
    if (!flowRef.current || validationErrors.length === 0) return;
    runChatGeneration(buildFixPrompt(validationErrors), t('editor.chat.fixErrorsLabel'));
  }, [runChatGeneration, t, validationErrors]);

  useEffect(() => {
    if (flowId !== initialFlowIdRef.current) {
      initialFlowIdRef.current = flowId;
      setGenerationStatus('idle');
      setGenerationMessage(null);
      setGenerationError(null);
      setSaveError(null);
      setPublishError(null);
      setDeleteError(null);
      setImageUploadBusySlotKey(null);
      setImageUploadError(null);
      skipNextJsonSyncRef.current = null;
    }
  }, [flowId]);

  const promptSuggestions = useMemo(() => getEditorStarterChoices(t), [t]);

  return {
    loading,
    error,
    flow,
    title,
    setTitle,
    prompt,
    setPrompt,
    imageUploadSlots,
    imageUploadBusySlotKey,
    imageUploadError,
    uploadJsonImage,
    jsonDraft,
    setJsonDraft: (value: string) => {
      jsonDraftRef.current = value;
      skipNextJsonSyncRef.current = null;
      setJsonDraft(value);
      setImageUploadError(null);
      const parsed = parseFlowDraft(value, t);
      setJsonError(parsed.error);
      if (parsed.flow) {
        setValidationErrors(validateSharedFlow(parsed.flow));
      }
    },
    jsonError,
    isDirty,
    hasPersistableChanges,
    canSaveDraft,
    canPublish,
    canDelete,
    generationStatus,
    generationMessage,
    generationError,
    saveBusy: saveBusy || previewSyncBusy || imageUploadBusy,
    saveError,
    publishBusy,
    publishError,
    deleteBusy,
    deleteError,
    validationErrors,
    canFixErrors,
    fixErrors,
    preview,
    favorite,
    toggleFavorite,
    messages,
    submitPrompt,
    saveDraft,
    publish,
    remove,
    reload,
    updatePreview: async () => {
      const current = flowRef.current;
      if (current) await runPreview(current.id);
    },
    promptSuggestions,
  };
}
