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
import { FLOW_VALIDATION_ERROR_CODES, validateFlow, type FlowValidationErrorCode } from '../../../src/validators/flow-validator.ts';
import type { WhatsAppFlow } from '../../../src/types/flow.ts';
import { createI18n } from './I18nProvider.tsx';
import { en } from './en/index.ts';
import { formatMessage } from './format.ts';
import { describeValidationIssue } from './validation.ts';

const done = { type: 'Footer', label: 'Done', 'on-click-action': { name: 'complete' } };
const screen = (id: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  layout: { type: 'SingleColumnLayout', children },
  ...extra,
});
const terminal = screen('END', [done], { terminal: true });
const goTo = (name?: string) => ({
  type: 'Footer',
  label: 'Go',
  'on-click-action': { name: 'navigate', ...(name ? { next: { type: 'screen', name } } : {}) },
});

// A flow that triggers each code.
const flows: Record<FlowValidationErrorCode, unknown> = {
  VERSION_REQUIRED: { screens: [terminal] },
  SCREENS_REQUIRED: { version: '6.0', screens: [] },
  SCREEN_NOT_OBJECT: { version: '6.0', screens: [null, terminal] },
  SCREEN_ID_DUPLICATE: { version: '6.0', screens: [terminal, terminal] },
  SCREEN_ID_REQUIRED: { version: '6.0', screens: [screen('', [done], { terminal: true })] },
  SCREEN_TITLE_REQUIRED: { version: '6.0', screens: [screen('A', [done], { terminal: true, title: '' })] },
  SCREEN_LAYOUT_REQUIRED: { version: '6.0', screens: [{ id: 'A', title: 'A', terminal: true }] },
  SCREEN_COMPONENTS_REQUIRED: { version: '6.0', screens: [screen('A', [], { terminal: true })] },
  TERMINAL_SCREEN_REQUIRED: { version: '6.0', screens: [screen('A', [done])] },
  COMPONENT_NOT_OBJECT: { version: '6.0', screens: [screen('A', ['x'], { terminal: true })] },
  INPUT_NAME_DUPLICATE: {
    version: '6.0',
    screens: [screen('A', [{ type: 'TextInput', name: 'email' }, { type: 'TextInput', name: 'email' }, done], { terminal: true })],
  },
  DATA_SOURCE_EMPTY: {
    version: '6.0',
    screens: [screen('A', [{ type: 'Dropdown', name: 'd', 'data-source': [] }, done], { terminal: true })],
  },
  FOOTER_ACTION_REQUIRED: { version: '6.0', screens: [screen('A', [{ type: 'Footer', label: 'Go' }], { terminal: true })] },
  NAVIGATE_TARGET_REQUIRED: { version: '6.0', screens: [screen('A', [goTo()]), terminal] },
  NAVIGATE_TARGET_UNKNOWN: { version: '6.0', screens: [screen('A', [goTo('NOPE')]), terminal] },
};

test('the English catalogue has exactly one template per code', () => {
  assert.deepEqual(Object.keys(en.validation).sort(), [...FLOW_VALIDATION_ERROR_CODES].sort());
});

test('formatting each English template with a real issue gives the validator message', () => {
  for (const code of FLOW_VALIDATION_ERROR_CODES) {
    const issue = validateFlow(flows[code] as WhatsAppFlow).errors.find((error) => error.code === code);
    assert.ok(issue, `${code} is not triggered`);
    assert.equal(formatMessage('en', en.validation[code], issue.params), issue.message, code);
  }
});

test('describeValidationIssue translates a known code with its params', () => {
  const { t } = createI18n();
  const issue = { code: 'SCREEN_ID_DUPLICATE', params: { id: 'WELCOME' }, message: 'Duplicate screen id: "WELCOME"' };
  assert.equal(describeValidationIssue(t, issue, 'fallback'), 'Duplicate screen id: "WELCOME"');
});

test('describeValidationIssue uses a host override for a known code', () => {
  const { t } = createI18n({
    locale: 'de',
    messages: { validation: { SCREEN_ID_DUPLICATE: 'Doppelte Bildschirm-ID: "{id}"' } },
  });
  const issue = { code: 'SCREEN_ID_DUPLICATE', params: { id: 'WELCOME', skipped: { a: 1 } }, message: 'English' };
  assert.equal(describeValidationIssue(t, issue, 'fallback'), 'Doppelte Bildschirm-ID: "WELCOME"');
});

test('describeValidationIssue falls back to message for unknown or missing codes', () => {
  const { t } = createI18n();
  assert.equal(describeValidationIssue(t, { code: 'SOMETHING_NEW', message: 'Server says no' }, 'fallback'), 'Server says no');
  assert.equal(describeValidationIssue(t, { message: 'Infobip says no' }, 'fallback'), 'Infobip says no');
  assert.equal(describeValidationIssue(t, { code: 42, message: 'Odd code' }, 'fallback'), 'Odd code');
});

test('describeValidationIssue uses the fallback when there is no usable message', () => {
  const { t } = createI18n();
  assert.equal(describeValidationIssue(t, {}, 'fallback'), 'fallback');
  assert.equal(describeValidationIssue(t, { message: '   ' }, 'fallback'), 'fallback');
});
