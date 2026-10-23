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

// ── Flow Builder chat history backup file ──────────────────────────────────
//
// Reads and writes the single JSON document behind Export/Import on the
// settings page. Pure by design — no `window`, no storage access, no React — so the
// envelope, the merge and the restore count are all directly unit-testable;
// `services/chatHistory.ts` stays the only module that touches stored history.
//
// Import is non-destructive: transcripts are unioned by message id, ordered by
// the epoch millis `createMessageId` embeds, so re-importing a file adds nothing
// and a transcript written since the backup is never replaced by an older one.

import type { Translate } from '../i18n/I18nProvider';
import { sanitizeChatMessages, type ChatHistoryMap } from './chatHistory';
import type { EditorChatMessage } from '../utils/chatMessages';

const BACKUP_KIND = 'flowbuilder-local-backup';
const BACKUP_VERSION = 1;

export type ChatHistoryBackup = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  chatHistory: ChatHistoryMap;
};

/** Messages, and the flows they landed in, that a restore actually added. */
export type RestoreCount = { messages: number; flows: number };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// `chatHistory` is a named key so `favorites` can join it later without bumping
// `version`; readers ignore keys they don't know.
export function buildBackup(map: ChatHistoryMap, now: Date): ChatHistoryBackup {
  return { kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: now.toISOString(), chatHistory: map };
}

export function serializeBackup(backup: ChatHistoryBackup): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Validate the envelope only — per-message checks belong to `chatHistory.ts`,
 * which drops malformed entries on the way into storage.
 *
 * `kind` is the load-bearing check: this app is full of flow JSON, so dropping
 * a flow file onto Import is the likely mistake, and it should be a clear
 * rejection rather than a successful import of nothing.
 */
export function parseBackup(
  t: Translate,
  text: string,
  productName = t('settings.chatHistory.backupProductName'),
): { backup: ChatHistoryBackup | null; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { backup: null, error: t('settings.chatHistory.errors.notJson') };
  }

  if (!isPlainObject(parsed) || parsed.kind !== BACKUP_KIND) {
    return { backup: null, error: t('settings.chatHistory.errors.notBackup', { productName }) };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { backup: null, error: t('settings.chatHistory.errors.newerVersion', { productName }) };
  }
  if (!isPlainObject(parsed.chatHistory)) {
    return { backup: null, error: t('settings.chatHistory.errors.notBackup', { productName }) };
  }

  return {
    backup: {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      chatHistory: parsed.chatHistory as ChatHistoryMap,
    },
    error: null,
  };
}

// Filter the incoming map before merging, so the count reported to the user is
// the number of messages actually stored rather than the number in the file.
export function sanitizeBackupHistory(chatHistory: ChatHistoryMap): ChatHistoryMap {
  const clean: ChatHistoryMap = {};
  for (const [flowId, messages] of Object.entries(chatHistory)) {
    const kept = sanitizeChatMessages(messages);
    if (kept.length > 0) clean[flowId] = kept;
  }
  return clean;
}

const MESSAGE_ID_TIMESTAMP = /-(\d+)-[^-]*$/;

function messageTimestamp(id: string): number | null {
  const match = MESSAGE_ID_TIMESTAMP.exec(id);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

// Sort key per message, carried forward: an id without an embedded timestamp
// (hand-edited files, older fixtures) inherits the one before it so it stays
// where its own transcript put it instead of sorting to the front.
function sortKeys(messages: EditorChatMessage[]): number[] {
  let last = Number.NEGATIVE_INFINITY;
  return messages.map((message) => {
    const stamp = messageTimestamp(message.id);
    if (stamp != null) last = stamp;
    return last;
  });
}

// Two-pointer merge, so each side keeps its own order whatever its ids look
// like. Ties resolve local-before-imported, which also keeps the local copy of
// a message present in both.
function mergeTranscripts(local: EditorChatMessage[], incoming: EditorChatMessage[]): EditorChatMessage[] {
  const localKeys = sortKeys(local);
  const incomingKeys = sortKeys(incoming);
  const merged: EditorChatMessage[] = [];
  const seen = new Set<string>();

  const take = (message: EditorChatMessage) => {
    if (seen.has(message.id)) return;
    seen.add(message.id);
    merged.push(message);
  };

  let l = 0;
  let i = 0;
  while (l < local.length && i < incoming.length) {
    if (localKeys[l] <= incomingKeys[i]) take(local[l++]);
    else take(incoming[i++]);
  }
  while (l < local.length) take(local[l++]);
  while (i < incoming.length) take(incoming[i++]);

  return merged;
}

export function mergeChatHistory(current: ChatHistoryMap, incoming: ChatHistoryMap): ChatHistoryMap {
  const merged: ChatHistoryMap = {};
  for (const [flowId, messages] of Object.entries(current)) {
    merged[flowId] = mergeTranscripts(messages, incoming[flowId] ?? []);
  }
  for (const [flowId, messages] of Object.entries(incoming)) {
    if (!(flowId in merged)) merged[flowId] = messages.slice();
  }
  return merged;
}

/** What the merge added on top of `current` — the number reported to the user. */
export function countRestored(current: ChatHistoryMap, merged: ChatHistoryMap): RestoreCount {
  let messages = 0;
  let flows = 0;

  for (const [flowId, transcript] of Object.entries(merged)) {
    const existing = new Set((current[flowId] ?? []).map((message) => message.id));
    const added = transcript.filter((message) => !existing.has(message.id)).length;
    if (added === 0) continue;
    messages += added;
    flows += 1;
  }

  return { messages, flows };
}

// Phrased from the count the write produced, so re-importing the same file
// says so plainly instead of claiming it restored everything again.
export function describeRestore(t: Translate, count: RestoreCount): string {
  if (count.messages === 0) return t('settings.chatHistory.results.alreadyRestored');
  return t('settings.chatHistory.results.restored', { messages: count.messages, flows: count.flows });
}

// Dated from the same instant as `exportedAt`, and in the same (UTC) terms, so
// the two always agree.
export function backupFileName(now: Date): string {
  return `flowbuilder-chat-history-${now.toISOString().slice(0, 10)}.json`;
}
