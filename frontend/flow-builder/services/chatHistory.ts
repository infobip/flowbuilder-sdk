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

// ── Flow Builder editor chat persistence ───────────────────────────────────
//
// The editor's chat transcript lives entirely client-side: a single storage
// key (`chat_history` in the builder instance's namespaced storage — by default
// localStorage's `flowbuilder_chat_history`) holds a
// `Record<flowId, EditorChatMessage[]>`. Reads/writes are defensive (private
// mode, quota, corrupt JSON) and mirror the favorites pattern used in
// `state/useEditorFlow.ts`. In-flight `pending` placeholders are never persisted
// so a restored transcript can't show a stuck spinner.

import type { EditorChatMessage, EditorChatRole } from '../utils/chatMessages';
import type { InstanceStorage } from './storage';

const CHAT_HISTORY = 'chat_history';

const VALID_ROLES: ReadonlySet<EditorChatRole> = new Set(['user', 'assistant', 'pending', 'error']);

export type ChatHistoryMap = Record<string, EditorChatMessage[]>;

function isEditorChatMessage(value: unknown): value is EditorChatMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.time === 'string' &&
    typeof candidate.role === 'string' &&
    VALID_ROLES.has(candidate.role as EditorChatRole)
  );
}

function readHistoryMap(storage: InstanceStorage): ChatHistoryMap {
  try {
    const raw = storage.read(CHAT_HISTORY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ChatHistoryMap;
  } catch {
    return {};
  }
}

// Storage failures (private mode, quota) are ignored for autosave writes.
function writeHistoryMap(storage: InstanceStorage, map: ChatHistoryMap): void {
  storage.write(CHAT_HISTORY, JSON.stringify(map));
}

// Keep only well-formed, persistable messages (drops any `pending` placeholder).
// Exported so the backup/restore path can filter an incoming map before merging
// it, with the same rules that guard every other read and write of this key.
export function sanitizeChatMessages(messages: unknown): EditorChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(isEditorChatMessage).filter((message) => message.role !== 'pending');
}

// Sanitize every transcript, dropping flows left with nothing — the same shape
// `saveChatHistory` keeps, where an empty transcript means no key at all.
function sanitizeHistoryMap(map: ChatHistoryMap): ChatHistoryMap {
  const clean: ChatHistoryMap = {};
  for (const [flowId, messages] of Object.entries(map)) {
    // Messages are stored as rendered text, so a saved transcript keeps the language it was written in.
  const persisted = sanitizeChatMessages(messages);
    if (persisted.length > 0) clean[flowId] = persisted;
  }
  return clean;
}

export function loadChatHistory(storage: InstanceStorage, flowId: string | null): EditorChatMessage[] {
  if (!flowId) return [];
  return sanitizeChatMessages(readHistoryMap(storage)[flowId]);
}

/** Every stored transcript, keyed by flow id. Used by the backup export. */
export function loadAllChatHistory(storage: InstanceStorage): ChatHistoryMap {
  return sanitizeHistoryMap(readHistoryMap(storage));
}

/**
 * Overwrite every transcript at once (the restore path).
 *
 * Unlike the autosave writes below, this reports failure: a swallowed quota or
 * private-mode error would leave the user believing their history came back.
 */
export function replaceAllChatHistory(storage: InstanceStorage, map: ChatHistoryMap): boolean {
  return storage.write(CHAT_HISTORY, JSON.stringify(sanitizeHistoryMap(map)));
}

/**
 * Drop every transcript at once (the settings page's Clear action).
 *
 * Reports failure for the same reason as `replaceAllChatHistory`: a swallowed
 * error would leave the user believing their history was gone when it wasn't.
 */
export function clearAllChatHistory(storage: InstanceStorage): boolean {
  return storage.remove(CHAT_HISTORY);
}

export function saveChatHistory(storage: InstanceStorage, flowId: string | null, messages: EditorChatMessage[]): void {
  if (!flowId) return;
  const map = readHistoryMap(storage);
  const persisted = sanitizeChatMessages(messages);
  if (persisted.length === 0) {
    if (!(flowId in map)) return;
    delete map[flowId];
  } else {
    map[flowId] = persisted;
  }
  writeHistoryMap(storage, map);
}

export function clearChatHistory(storage: InstanceStorage, flowId: string | null): void {
  if (!flowId) return;
  const map = readHistoryMap(storage);
  if (!(flowId in map)) return;
  delete map[flowId];
  writeHistoryMap(storage, map);
}
