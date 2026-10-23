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
import { FlowBuilderApiError } from '../../api.ts';
import { describeError } from './errors.ts';
import { createI18n } from './I18nProvider.tsx';
import { en } from './en/index.ts';
import type { MessageKey } from './messages.ts';

const german = createI18n({
  locale: 'de',
  messages: { errors: { network: 'Server nicht erreichbar.', codes: { FORBIDDEN: 'Keine Berechtigung.', UPSTREAM_ERROR: 'Infobip-Fehler (HTTP {status}).' } } },
});

test('describeError: English shows the server message, as it always has', () => {
  const { t } = createI18n();
  assert.equal(describeError(t, new FlowBuilderApiError('Forbidden', 403, 'FORBIDDEN'), 'errors.unknown'), 'Forbidden');
  assert.equal(describeError(t, new TypeError('Failed to fetch'), 'errors.unknown'), 'Failed to fetch');
  assert.equal(describeError(t, new Error('boom'), 'errors.unknown'), 'boom');
});

test('describeError: a code the host translated wins over the server text, with {status}', () => {
  const { t } = german;
  assert.equal(describeError(t, new FlowBuilderApiError('Forbidden', 403, 'FORBIDDEN'), 'errors.unknown'), 'Keine Berechtigung.');
  assert.equal(describeError(t, new FlowBuilderApiError('Bad gateway', 502, 'UPSTREAM_ERROR'), 'errors.unknown'), 'Infobip-Fehler (HTTP 502).');
});

test('describeError: untranslated codes, unknown codes and codeless errors keep the server text', () => {
  const { t } = german;
  assert.equal(describeError(t, new FlowBuilderApiError('Not found', 404, 'NOT_FOUND'), 'errors.unknown'), 'Not found');
  assert.equal(describeError(t, new FlowBuilderApiError('Odd', 400, 'SOMETHING_NEW'), 'errors.unknown'), 'Odd');
  assert.equal(describeError(t, new FlowBuilderApiError('Plain', 500), 'errors.unknown'), 'Plain');
});

test('describeError: a translated network message replaces fetch TypeErrors only', () => {
  const { t } = german;
  assert.equal(describeError(t, new TypeError('Failed to fetch'), 'errors.unknown'), 'Server nicht erreichbar.');
  assert.equal(describeError(t, new Error('boom'), 'errors.unknown'), 'boom');
});

test('describeError: no message falls back to the given key', () => {
  const { t } = createI18n();
  assert.equal(describeError(t, undefined, 'errors.unknown'), en.errors.unknown);
  assert.equal(describeError(t, new Error(''), 'errors.network'), en.errors.network);
});

test('describeError: a bare t without isOverridden is treated as untranslated', () => {
  const t = (key: MessageKey) => `<${key}>`;
  assert.equal(describeError(t, new FlowBuilderApiError('Forbidden', 403, 'FORBIDDEN'), 'errors.unknown'), 'Forbidden');
});

test('every server error code has an English message', () => {
  const codes = ['INVALID_JSON', 'PAYLOAD_TOO_LARGE', 'BAD_REQUEST', 'UPSTREAM_INVALID_RESPONSE', 'DOWNLOAD_URL_MISSING', 'INVALID_FLOW_ID', 'NOT_FOUND', 'CONFIGURATION_ERROR', 'DOWNLOAD_URL_INVALID', 'UPSTREAM_UNREACHABLE', 'UPSTREAM_ERROR', 'INTERNAL_ERROR', 'FORBIDDEN', 'AUTHORIZATION_ERROR', 'FLOW_STILL_INDEXING', 'DOWNLOAD_HOST_NOT_ALLOWED', 'DOWNLOAD_TOO_MANY_REDIRECTS'];
  for (const code of codes) assert.ok(code in en.errors.codes, code);
});
