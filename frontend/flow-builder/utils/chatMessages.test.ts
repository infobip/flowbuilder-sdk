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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WhatsAppFlow } from '../../shared.ts';
import {
  buildAssistantMessage,
  buildErrorMessage,
  buildPendingMessage,
  buildUserMessage,
  replaceMessage,
  summarizeFlow,
  type EditorChatMessage,
} from './chatMessages.ts';
import { createI18n } from '../i18n/I18nProvider.tsx';

const { t } = createI18n();

function flowWith(ids: string[]): WhatsAppFlow {
  return {
    version: '6.0',
    screens: ids.map((id) => ({ id, title: id })),
  };
}

test('builders produce the expected roles and unique ids', () => {
  const user = buildUserMessage('hi');
  const pending = buildPendingMessage(t);
  const assistant = buildAssistantMessage('done');
  const error = buildErrorMessage('boom');

  assert.equal(user.role, 'user');
  assert.equal(user.text, 'hi');
  assert.equal(pending.role, 'pending');
  assert.equal(pending.text, 'Generating…');
  assert.equal(assistant.role, 'assistant');
  assert.equal(error.role, 'error');

  const ids = new Set([user.id, pending.id, assistant.id, error.id]);
  assert.equal(ids.size, 4);
  for (const message of [user, pending, assistant, error]) {
    assert.equal(typeof message.time, 'string');
    assert.ok(message.time.length > 0);
  }
});

test('summarizeFlow: created with multiple screens lists ids', () => {
  const text = summarizeFlow(flowWith(['WELCOME', 'DETAILS', 'CONFIRM']), t);
  assert.equal(text, 'Created your flow with 3 screens: WELCOME, DETAILS, CONFIRM.');
});

test('summarizeFlow: singular noun for a single screen', () => {
  const text = summarizeFlow(flowWith(['ONLY']), t);
  assert.equal(text, 'Created your flow with 1 screen: ONLY.');
});

test('summarizeFlow: updated action uses the update verb', () => {
  const text = summarizeFlow(flowWith(['A', 'B']), t, 'updated');
  assert.equal(text, 'Updated your flow — 2 screens: A, B.');
});

test('summarizeFlow: no screen ids omits the id list', () => {
  const flow = { version: '6.0', screens: [] } as WhatsAppFlow;
  assert.equal(summarizeFlow(flow, t), 'Created your flow with 0 screens.');
});

test('summarizeFlow: tolerates a non-array screens field', () => {
  const flow = { version: '6.0', screens: undefined } as unknown as WhatsAppFlow;
  assert.equal(summarizeFlow(flow, t), 'Created your flow with 0 screens.');
});

test('replaceMessage: swaps the matching id and preserves order', () => {
  const a: EditorChatMessage = { id: 'a', role: 'user', text: 'a', time: '00:00' };
  const b: EditorChatMessage = { id: 'b', role: 'pending', text: '…', time: '00:01' };
  const c: EditorChatMessage = { id: 'c', role: 'user', text: 'c', time: '00:02' };
  const next: EditorChatMessage = { id: 'b', role: 'assistant', text: 'done', time: '00:03' };

  const result = replaceMessage([a, b, c], 'b', next);
  assert.deepEqual(result.map((m) => m.id), ['a', 'b', 'c']);
  assert.equal(result[1], next);
});

test('replaceMessage: returns the list unchanged when the id is absent', () => {
  const a: EditorChatMessage = { id: 'a', role: 'user', text: 'a', time: '00:00' };
  const list = [a];
  const result = replaceMessage(list, 'missing', { id: 'x', role: 'assistant', text: 'x', time: '00:04' });
  assert.equal(result, list);
});

test('summarizeFlow: the host catalogue words the summary and its plural', () => {
  const de = createI18n({
    locale: 'de',
    messages: { editor: { chat: { summaryCreatedWithIds: '{count|one:# Bildschirm|other:# Bildschirme} erstellt: {ids}.' } } },
  });
  assert.equal(summarizeFlow(flowWith(['A', 'B']), de.t), '2 Bildschirme erstellt: A, B.');
});
