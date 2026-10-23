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
import { lockBodyScroll } from './scrollLock.ts';

function fakeDocument(overflow = 'auto'): Document {
  return { body: { style: { overflow } } } as unknown as Document;
}

test('locks body scroll and restores the original value on release', () => {
  const doc = fakeDocument('scroll');
  const release = lockBodyScroll(doc);
  assert.equal(doc.body.style.overflow, 'hidden');
  release();
  assert.equal(doc.body.style.overflow, 'scroll');
});

test('is reference counted: only the last release restores', () => {
  const doc = fakeDocument('auto');
  const first = lockBodyScroll(doc);
  const second = lockBodyScroll(doc);
  first();
  assert.equal(doc.body.style.overflow, 'hidden');
  second();
  assert.equal(doc.body.style.overflow, 'auto');
});

test('releasing twice does not unbalance the count', () => {
  const doc = fakeDocument('');
  const first = lockBodyScroll(doc);
  const second = lockBodyScroll(doc);
  first();
  first();
  assert.equal(doc.body.style.overflow, 'hidden');
  second();
  assert.equal(doc.body.style.overflow, '');
});
