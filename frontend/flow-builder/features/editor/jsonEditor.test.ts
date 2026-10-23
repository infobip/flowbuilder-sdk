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
  findJsonMatches,
  formatValidationLocation,
  getJsonLineCount,
  getJsonLineRange,
  getJsonLineRanges,
  normalizeEditorValidationIssues,
  parseJsonDraft,
} from '../../utils/jsonEditor.ts';
import { createI18n } from '../../i18n/I18nProvider.tsx';

const { t } = createI18n();

test('parseJsonDraft: rejects invalid JSON and keeps the message', () => {
  const parsed = parseJsonDraft('{', t);
  assert.equal(parsed.value, null);
  assert.ok((parsed.error ?? '').length > 0);
});

test('getJsonLineCount and range: map lines for navigation', () => {
  const value = '{\n  "a": 1,\n  "b": 2\n}';
  assert.equal(getJsonLineCount(value), 4);
  assert.deepEqual(getJsonLineRange(value, 2), { start: 2, end: 11 });
});

test('getJsonLineRanges: line content excludes CRLF breaks', () => {
  assert.deepEqual(getJsonLineRanges('a\r\nbb'), [
    { start: 0, end: 1 },
    { start: 3, end: 5 },
  ]);
});

test('findJsonMatches: returns every hit, case-insensitively by default', () => {
  const value = '{"title": "Demo", "label": "demo"}';
  assert.equal(findJsonMatches(value, 'demo').length, 2);
  assert.equal(findJsonMatches(value, 'demo', { caseSensitive: true }).length, 1);
  assert.deepEqual(findJsonMatches(value, ''), []);
});

test('findJsonMatches: hits do not overlap', () => {
  assert.deepEqual(findJsonMatches('aaaa', 'aa'), [
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ]);
});

test('normalizeEditorValidationIssues: retains metadata and line info', () => {
  const issues = normalizeEditorValidationIssues([
    { message: 'Missing field', path: 'screens[0].title', line: 3, column: 9 },
  ], t);
  assert.equal(issues[0].severity, 'warning');
  assert.equal(formatValidationLocation(issues[0], t), 'Line 3, Column 9');
});

test('validation location: line only, path only and nothing, in the host language', () => {
  const [lineOnly, pathOnly, nothing] = normalizeEditorValidationIssues([
    { message: 'a', line: 1234 },
    { message: 'b', path: 'screens[0]' },
    {},
  ], t);
  assert.equal(formatValidationLocation(lineOnly, t), 'Line 1234');
  assert.equal(formatValidationLocation(pathOnly, t), 'screens[0]');
  assert.equal(formatValidationLocation(nothing, t), 'No line information');
  assert.equal(nothing.message, 'Validation issue.');

  const de = createI18n({ locale: 'de', messages: { editor: { validation: { lineColumn: 'Zeile {line}, Spalte {column}' } } } });
  assert.equal(formatValidationLocation(normalizeEditorValidationIssues([{ line: 3, column: 9 }], de.t)[0], de.t), 'Zeile 3, Spalte 9');
});

test('parseJsonDraft: its own messages come from the catalogue', () => {
  assert.equal(parseJsonDraft('  ', t).error, 'Flow JSON is empty.');
});
