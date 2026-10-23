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
import {
  PREVIEW_EXPIRY_FORMAT,
  buildEditorFlowName,
  deriveEditorTitleFromPrompt,
  getEditorStarterChoices,
  normalizeEditorTitle,
  resolveEditorDocumentTitle,
} from './editor.ts';
import { createI18n } from '../i18n/I18nProvider.tsx';
import { MAX_FLOW_NAME_LENGTH } from '../../shared.ts';

const { t } = createI18n();

const MODE = 'prompt' as const;

test('normalizeEditorTitle: trims whitespace and falls back to Untitled flow', () => {
  assert.equal(normalizeEditorTitle('  Appointment booking  ', t), 'Appointment booking');
  assert.equal(normalizeEditorTitle('', t), 'Untitled flow');
  assert.equal(normalizeEditorTitle('   ', t), 'Untitled flow');
});

test('buildEditorFlowName: keeps the response id suffix convention', () => {
  assert.equal(buildEditorFlowName('Lead generation', t, 'abc123'), 'Lead generation##abc123');
  assert.equal(buildEditorFlowName('   ', t, null), 'Untitled flow');
});

test('buildEditorFlowName: caps the combined name at 200 chars, preserving the responseId', () => {
  const longTitle = 'An event registration flow collecting attendee details, ticket type, and dietary preferences';
  const responseId = 'r'.repeat(128);
  const name = buildEditorFlowName(longTitle, t, responseId);

  assert.ok(name.length <= MAX_FLOW_NAME_LENGTH, `expected <= 200, got ${name.length}`);
  // The responseId must survive intact after the first `##`.
  assert.equal(name.slice(name.indexOf('##') + 2), responseId);
  assert.ok(longTitle.startsWith(name.slice(0, name.indexOf('##'))));
});

test('deriveEditorTitleFromPrompt: short prompts pass through, long ones clip on a word boundary', () => {
  assert.equal(deriveEditorTitleFromPrompt('Appointment booking flow'), 'Appointment booking flow');
  assert.equal(deriveEditorTitleFromPrompt('  Lead   gen\nsecond line  '), 'Lead gen');

  const long = 'An event registration flow collecting attendee details, ticket type, and dietary preferences';
  const derived = deriveEditorTitleFromPrompt(long);
  assert.ok(derived.length <= 61, `expected <= 61, got ${derived.length}`);
  assert.ok(derived.endsWith('…'));
  assert.ok(!derived.slice(0, -1).endsWith(' '));
});

test('resolveEditorDocumentTitle: reflects create and edit routes', () => {
  assert.equal(resolveEditorDocumentTitle({ flowId: null, flowTitle: '', mode: MODE, productName: 'AI Flow Builder' }, t), 'Create flow · AI Flow Builder');
  assert.equal(resolveEditorDocumentTitle({ flowId: 'flow-1', flowTitle: 'Booking', mode: MODE, productName: 'AI Flow Builder' }, t), 'Booking · AI Flow Builder');
  assert.equal(resolveEditorDocumentTitle({ flowId: 'flow-1', flowTitle: '   ', mode: 'json', productName: 'AI Flow Builder' }, t), 'Edit flow · AI Flow Builder');
});

test('resolveEditorDocumentTitle: uses the host product name', () => {
  assert.equal(resolveEditorDocumentTitle({ flowId: null, flowTitle: '', mode: MODE, productName: 'Acme Flows' }, t), 'Create flow · Acme Flows');
  assert.equal(resolveEditorDocumentTitle({ flowId: 'flow-1', flowTitle: 'Booking', mode: MODE, productName: 'Acme Flows' }, t), 'Booking · Acme Flows');
});

test('getEditorStarterChoices: exposes the expected starter prompts', () => {
  const choices = getEditorStarterChoices(t);
  assert.equal(choices.length, 4);
  assert.deepEqual(
    choices.map((choice) => choice.label),
    ['Appointment booking', 'Lead generation', 'Customer survey', 'Event registration'],
  );
  assert.equal(choices[0].prompt, 'A 3-step appointment booking flow with name, preferred date, and service type');
});

test('getEditorStarterChoices: labels and prompts follow the host catalogue', () => {
  const de = createI18n({
    locale: 'de',
    messages: { editor: { starters: { lead: { label: 'Leads', prompt: 'Ein Lead-Flow' } } } },
  });
  const lead = getEditorStarterChoices(de.t)[1];
  assert.deepEqual(lead, { label: 'Leads', prompt: 'Ein Lead-Flow' });
});

test('PREVIEW_EXPIRY_FORMAT: prints what toLocaleString() prints in English', () => {
  const date = new Date(2026, 2, 1, 14, 5, 9);
  assert.equal(new Intl.DateTimeFormat('en-US', PREVIEW_EXPIRY_FORMAT).format(date), date.toLocaleString('en-US'));
});
