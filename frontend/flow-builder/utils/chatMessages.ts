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

// ── Flow Builder editor chat model ─────────────────────────────────────────
//
// A tiny, text-only message model for the editor's chat panel. The generation
// API returns no assistant prose, so assistant turns are plain-text summaries
// derived locally from the generated flow (see `summarizeFlow`). The transcript
// is persisted per flow by `services/chatHistory.ts`.

import { createMessageId, nowTime, type WhatsAppFlow } from '../../shared';
import type { Translate } from '../i18n/I18nProvider';

export type EditorChatRole = 'user' | 'assistant' | 'pending' | 'error';

export type EditorChatMessage = {
  id: string;
  role: EditorChatRole;
  text: string;
  time: string;
};

export function buildUserMessage(text: string, locale?: string): EditorChatMessage {
  return { id: createMessageId('user'), role: 'user', text, time: nowTime(locale) };
}

export function buildPendingMessage(t: Translate, locale?: string): EditorChatMessage {
  return { id: createMessageId('pending'), role: 'pending', text: t('editor.chat.generating'), time: nowTime(locale) };
}

export function buildAssistantMessage(text: string, locale?: string): EditorChatMessage {
  return { id: createMessageId('assistant'), role: 'assistant', text, time: nowTime(locale) };
}

export function buildErrorMessage(text: string, locale?: string): EditorChatMessage {
  return { id: createMessageId('error'), role: 'error', text, time: nowTime(locale) };
}

// Replace the message with `id`, preserving order. Returns the list unchanged
// when the id is not present.
export function replaceMessage(
  messages: EditorChatMessage[],
  id: string,
  next: EditorChatMessage,
): EditorChatMessage[] {
  const index = messages.findIndex((message) => message.id === id);
  if (index < 0) return messages;
  const copy = messages.slice();
  copy[index] = next;
  return copy;
}

// Plain-text summary of a generated/updated flow, used as the assistant turn.
export function summarizeFlow(flow: WhatsAppFlow, t: Translate, action: 'created' | 'updated' = 'created'): string {
  const screens = Array.isArray(flow.screens) ? flow.screens : [];
  const count = screens.length;
  const ids = screens
    .map((screen) => (screen && typeof screen.id === 'string' ? screen.id : ''))
    .filter(Boolean);

  if (action === 'updated') {
    return ids.length
      ? t('editor.chat.summaryUpdatedWithIds', { count, ids: ids.join(', ') })
      : t('editor.chat.summaryUpdated', { count });
  }
  return ids.length
    ? t('editor.chat.summaryCreatedWithIds', { count, ids: ids.join(', ') })
    : t('editor.chat.summaryCreated', { count });
}
