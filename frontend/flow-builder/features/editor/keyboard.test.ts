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
import { detectKeyboardPlatform, isLetterKey, shortcutLabels } from '../../utils/keyboard.ts';

test('detectKeyboardPlatform: recognises Apple keyboards', () => {
  assert.equal(detectKeyboardPlatform({ platform: 'MacIntel' }), 'apple');
  assert.equal(detectKeyboardPlatform({ userAgent: 'Mozilla/5.0 (iPhone)' }), 'apple');
  assert.equal(detectKeyboardPlatform({ platform: 'Win32' }), 'other');
  assert.equal(detectKeyboardPlatform(), 'other');
});

test('shortcutLabels: platform specific modifier glyphs', () => {
  assert.equal(shortcutLabels('apple').mod, '⌘');
  assert.equal(shortcutLabels('other').mod, 'Ctrl+');
});

test('isLetterKey: falls back to the physical code when Alt mangles the character', () => {
  assert.equal(isLetterKey({ key: 'ƒ', code: 'KeyF' }, 'f'), true);
  assert.equal(isLetterKey({ key: 'F' }, 'f'), true);
  assert.equal(isLetterKey({ key: 'g', code: 'KeyG' }, 'f'), false);
});
