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
import { findIndexByPrefix, indexOfValue, labelForValue, stepActiveIndex, wrapIndex } from './selectMenu.ts';

const OPTIONS = [
  { value: 'ALL', label: 'All categories' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'SURVEY', label: 'Survey' },
  { value: 'OTHER', label: 'Other' },
] as const;

test('wrapIndex: wraps both directions', () => {
  assert.equal(wrapIndex(0, 4), 0);
  assert.equal(wrapIndex(4, 4), 0);
  assert.equal(wrapIndex(-1, 4), 3);
  assert.equal(wrapIndex(0, 0), 0);
});

test('stepActiveIndex: moves and wraps at the ends', () => {
  assert.equal(stepActiveIndex(0, 1, 4), 1);
  assert.equal(stepActiveIndex(3, 1, 4), 0);
  assert.equal(stepActiveIndex(0, -1, 4), 3);
});

test('indexOfValue / labelForValue: resolve the selected option', () => {
  assert.equal(indexOfValue(OPTIONS, 'SURVEY'), 2);
  assert.equal(indexOfValue(OPTIONS, 'MISSING' as typeof OPTIONS[number]['value']), 0);
  assert.equal(labelForValue(OPTIONS, 'SIGN_UP', 'Select…'), 'Sign Up');
  assert.equal(labelForValue(OPTIONS, 'MISSING' as typeof OPTIONS[number]['value'], 'Select…'), 'Select…');
});

test('findIndexByPrefix: matches from the current option, wrapping around', () => {
  assert.equal(findIndexByPrefix(OPTIONS, 's', 0), 1);
  assert.equal(findIndexByPrefix(OPTIONS, 's', 1), 2);
  assert.equal(findIndexByPrefix(OPTIONS, 'su', 1), 2);
  assert.equal(findIndexByPrefix(OPTIONS, 'o', 0), 3);
  assert.equal(findIndexByPrefix(OPTIONS, 'zzz', 2), 2);
});
