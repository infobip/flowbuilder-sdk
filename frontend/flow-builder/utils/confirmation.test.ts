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
import { isConfirmationAllowed } from './confirmation.ts';

test('a confirmation is unavailable when its feature is disabled, even if it was open', () => {
  assert.equal(isConfirmationAllowed(false, true), false);
});

test('a confirmation is available only while enabled and open', () => {
  assert.equal(isConfirmationAllowed(true, true), true);
  assert.equal(isConfirmationAllowed(true, false), false);
  assert.equal(isConfirmationAllowed(false, false), false);
});
