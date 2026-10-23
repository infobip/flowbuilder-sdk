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

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/button/Button';
import { IconButton } from '../components/button/IconButton';
import { Badge, type BadgeTone } from '../components/badge/Badge';
import { Skeleton } from '../components/loading/Skeleton';
import { ErrorState } from '../components/empty-state/ErrorState';
import { ConfirmDialog } from '../components/dialog/ConfirmDialog';
import { UNDERLINE_TABLIST_CLASS, underlineTabClassName } from '../components/tabs/underlineTabs';
import { useFeatures, useHostConfig } from '../app/hostConfig';
import { useDocumentTitle, useNavigate, useReportDirty } from '../app/instanceContext';
import { useEditorFlow } from '../state/useEditorFlow';
import { useI18n, useT } from '../i18n/I18nProvider';
import { describeValidationIssue } from '../i18n/validation';
import { isConfirmationAllowed } from '../utils/confirmation';
import { PREVIEW_EXPIRY_FORMAT, resolveEditorDocumentTitle } from '../utils/editor';
import type { EditorMode } from '../utils/routing';
import { JsonCodeEditor } from '../features/editor/JsonCodeEditor';
import { EditorTopBar } from '../features/editor/EditorTopBar';
import { PreviewPanel } from '../features/editor/PreviewPanel';
import { ChatPanel } from '../features/editor/ChatPanel';
import { ImageUploadSlots } from '../features/editor/ImageUploadSlots';
import { formatValidationLocation, normalizeEditorValidationIssues, type JsonEditorValidationIssue } from '../utils/jsonEditor';

export type EditorPageProps = {
  /** null → create (blank) flow; otherwise edit an existing flow. */
  flowId: string | null;
  mode: EditorMode;
};

const MODE_TABS: ReadonlyArray<{ value: EditorMode; labelKey: 'editor.modes.prompt' | 'editor.modes.json' }> = [
  { value: 'prompt', labelKey: 'editor.modes.prompt' },
  { value: 'json', labelKey: 'editor.modes.json' },
];

function ValidationIssues({
  issues,
  onGoToLine,
}: {
  issues: JsonEditorValidationIssue[];
  onGoToLine: (line: number) => void;
}) {
  const t = useT();
  if (issues.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-13 font-bold">{t('editor.validation.title')}</div>
        <Badge tone="warning" dot>
          {t('editor.validation.count', { count: issues.length })}
        </Badge>
      </div>
      <div className="flex flex-col gap-2">
        {issues.map((issue) => (
          <div
            key={`${issue.index}-${issue.path ?? issue.message}`}
            className="flex flex-col gap-1.5 rounded-lg border border-default bg-surface px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold">{describeValidationIssue(t, issue, t('editor.validation.unknownIssue'))}</div>
              <Badge tone={issue.severity === 'warning' ? 'warning' : 'danger'} dot>
                {t(issue.severity === 'warning' ? 'editor.validation.severity.warning' : 'editor.validation.severity.error')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-12 text-subtle">
                {issue.path
                  ? t('editor.validation.locationWithPath', { location: formatValidationLocation(issue, t), path: issue.path })
                  : formatValidationLocation(issue, t)}
              </span>
              {issue.line != null ? (
                <Button variant="ghost" size="sm" onClick={() => onGoToLine(issue.line ?? 1)}>
                  {t('editor.validation.goToLine')}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditorPage({ flowId, mode }: EditorPageProps) {
  const { t, formatDate } = useI18n();
  const navigate = useNavigate();
  const features = useFeatures();
  const { productName } = useHostConfig();
  const [topBarHeight, setTopBarHeight] = useState<number | null>(null);
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);

  const {
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
    setJsonDraft,
    jsonError,
    isDirty,
    generationStatus,
    generationError,
    saveBusy,
    saveError,
    publishBusy,
    publishError,
    deleteBusy,
    deleteError,
    validationErrors,
    canFixErrors,
    canSaveDraft,
    canPublish,
    canDelete,
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
    updatePreview,
    promptSuggestions,
  } = useEditorFlow(flowId, mode);

  const isNew = flowId == null;
  const hasFlow = flow != null;
  const generating = generationStatus === 'submitting' || generationStatus === 'generating';
  const statusLabel = hasFlow ? (isDirty ? t('editor.status.draft') : t('editor.status.saved')) : t('editor.status.draft');
  const statusTone: BadgeTone = hasFlow ? (isDirty ? 'warning' : 'success') : 'warning';
  const jsonIssues = useMemo(() => normalizeEditorValidationIssues(validationErrors, t), [validationErrors, t]);
  const currentJsonIssues = jsonError ? [] : jsonIssues;

  // The host decides what to do with the title (the standalone app writes
  // document.title); on leaving, the page reports null so the host restores
  // its default.
  useDocumentTitle(resolveEditorDocumentTitle({ flowId, flowTitle: title || flow?.displayName || '', mode, productName }, t));
  // Lets the host guard its own navigation while there are unsaved changes.
  useReportDirty(isDirty);

  useEffect(() => {
    if (flow?.status === 'PUBLISHED' && flowId) {
      navigate({ name: 'flow-preview', flowId });
    }
  }, [flow?.status, flowId, navigate]);

  const setMode = (next: EditorMode) => {
    if (next === mode) return;
    if (isNew) navigate({ name: 'flow-new', mode: next });
    else if (flowId) navigate({ name: 'flow-edit', flowId, mode: next });
  };

  const goToLine = (line: number) => {
    setFocusLine(line);
    setFocusRequestId((current) => current + 1);
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

  const bottomDisabled = !hasFlow || saveBusy || publishBusy || deleteBusy;
  const deleteVisible = features.delete && hasFlow && flow?.status === 'DRAFT';
  const publishDisabled = bottomDisabled || !canPublish || preview.status === 'loading' || jsonError != null || jsonIssues.length > 0;
  const saveDisabled = bottomDisabled || !canSaveDraft;
  const deleteDisabled = bottomDisabled || !canDelete;
  const deleteConfirmationOpen = isConfirmationAllowed(features.delete && deleteVisible && !deleteDisabled, confirmDeleteOpen);
  const publishConfirmationOpen = isConfirmationAllowed(features.publish && !publishDisabled, confirmPublishOpen);

  useEffect(() => {
    if (!features.delete || deleteDisabled) setConfirmDeleteOpen(false);
  }, [features.delete, deleteDisabled]);
  useEffect(() => {
    if (!features.publish || publishDisabled) setConfirmPublishOpen(false);
  }, [features.publish, publishDisabled]);

  const actionErrors = [
    generationError && { key: 'generation', title: t('editor.errorTitles.generation'), message: generationError },
    saveError && { key: 'save', title: t('editor.errorTitles.save'), message: saveError },
    publishError && { key: 'publish', title: t('editor.errorTitles.publish'), message: publishError },
    deleteError && { key: 'delete', title: t('editor.errorTitles.delete'), message: deleteError },
  ].filter(Boolean) as Array<{ key: string; title: string; message: string }>;

  return (
    // `--fb-topbar-h` is the sticky top bar's measured height, so the preview
    // column sticks just beneath it with a 7px gap — 76px in total at the
    // bar's usual 69px, the offset this column has always had.
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={topBarHeight != null ? ({ '--fb-topbar-h': `${topBarHeight}px` } as React.CSSProperties) : undefined}
    >
      <EditorTopBar
        onHeightChange={setTopBarHeight}
        title={title}
        onTitleChange={setTitle}
        statusLabel={statusLabel}
        statusTone={statusTone}
        canFixErrors={canFixErrors}
        fixBusy={generating}
        errorCount={validationErrors.length}
        onFixErrors={fixErrors}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)] items-start gap-6 px-8 py-6 narrow:grid-cols-[1fr] narrow:px-5 narrow:pt-5 narrow:pb-6">
        <section className="sticky top-[calc(var(--fb-topbar-h,69px)+7px)] flex min-w-0 flex-col gap-3.5 narrow:static narrow:top-auto" aria-label={t('editor.preview.sectionLabel')}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-15 font-semibold text-default">{t('editor.preview.title')}</h2>
            <Badge tone={preview.status === 'error' ? 'danger' : preview.status === 'loading' || generating ? 'primary' : 'neutral'} dot>
              {generating ? t('editor.preview.status.generating') : t(`editor.preview.status.${preview.status}`)}
            </Badge>
          </div>
          {loading ? (
            <Skeleton width="100%" height={420} rounded="xl" />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <PreviewPanel hasFlow={hasFlow} loading={loading} generating={generating} preview={preview} />
          )}
          {preview.expiresAt && (
            <div className="text-center text-12 text-subtle">
              {t('editor.preview.expires', { time: formatDate(preview.expiresAt, PREVIEW_EXPIRY_FORMAT) })}
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4" aria-label={t('editor.preview.builderLabel')}>
          <div className={UNDERLINE_TABLIST_CLASS} role="tablist" aria-label={t('editor.modes.label')}>
            {MODE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                className={underlineTabClassName(mode === tab.value)}
                onClick={() => setMode(tab.value)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          <ImageUploadSlots
            slots={imageUploadSlots}
            busySlotKey={imageUploadBusySlotKey}
            error={imageUploadError}
            disabled={loading || !hasFlow || generating || saveBusy || publishBusy || deleteBusy}
            onUpload={(slot, file) => {
              void uploadJsonImage(slot, file);
            }}
          />

          {mode === 'prompt' ? (
            <ChatPanel
              messages={messages}
              hasFlow={hasFlow}
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={submitPrompt}
              busy={generating || imageUploadBusySlotKey !== null}
              templates={promptSuggestions}
              onPickTemplate={setPrompt}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <JsonCodeEditor
                focusLine={focusLine}
                focusRequestId={focusRequestId}
                value={jsonDraft}
                error={jsonError}
                issues={currentJsonIssues}
                onChange={setJsonDraft}
                onSave={() => void updatePreview()}
                canSave={hasFlow && !saveBusy && !publishBusy && !deleteBusy}
                saving={saveBusy}
                disabled={!hasFlow || imageUploadBusySlotKey !== null}
              />
              <ValidationIssues issues={currentJsonIssues} onGoToLine={goToLine} />
            </div>
          )}

          {actionErrors.map((entry) => (
            <ErrorState key={entry.key} title={entry.title} message={entry.message} />
          ))}
        </section>
      </div>

      <div className="sticky bottom-0 z-5 flex items-center justify-between gap-4 border-t border-default bg-surface px-8 py-3.5 narrow:flex-wrap narrow:gap-3 narrow:px-4">
        <div className="flex items-center gap-2">
          <IconButton label={favorite ? t('editor.actions.removeFavorite') : t('editor.actions.favorite')} onClick={toggleFavorite} disabled={!hasFlow} bordered>
            <span className="text-18 leading-none">{favorite ? '★' : '☆'}</span>
          </IconButton>
          {deleteVisible ? (
            <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)} disabled={deleteDisabled}>
              {deleteBusy ? t('editor.actions.deleting') : t('editor.actions.delete')}
            </Button>
          ) : null}
        </div>

        {features.publish ? (
          <div className="inline-flex items-center gap-1.5 text-center text-13 text-muted narrow:order-3 narrow:w-full narrow:justify-center">
            <span aria-hidden="true">🔒</span> {t('editor.actions.publishNotice')}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={saveDraft} disabled={saveDisabled}>
            {saveBusy ? t('editor.actions.saving') : t('editor.actions.saveDraft')}
          </Button>
          {features.publish ? (
            <Button variant="primary" onClick={() => setConfirmPublishOpen(true)} disabled={publishDisabled}>
              {publishBusy ? t('editor.actions.publishing') : t('editor.actions.publish')}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmationOpen}
        title={t('editor.deleteDialog.title')}
        message={t('editor.deleteDialog.message', { name: flow?.displayName ?? t('editor.deleteDialog.fallbackName') })}
        confirmLabel={t('editor.deleteDialog.confirm')}
        cancelLabel={t('editor.deleteDialog.cancel')}
        tone="danger"
        busy={deleteBusy}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (!deleteConfirmationOpen) return;
          setConfirmDeleteOpen(false);
          void remove();
        }}
      />

      <ConfirmDialog
        open={publishConfirmationOpen}
        title={t('editor.publishDialog.title')}
        message={t('editor.publishDialog.message', { name: flow?.displayName ?? t('editor.publishDialog.fallbackName') })}
        confirmLabel={t('editor.publishDialog.confirm')}
        cancelLabel={t('editor.publishDialog.cancel')}
        tone="primary"
        busy={publishBusy}
        onCancel={() => setConfirmPublishOpen(false)}
        onConfirm={() => {
          if (!publishConfirmationOpen) return;
          setConfirmPublishOpen(false);
          void publish();
        }}
      />
    </div>
  );
}
