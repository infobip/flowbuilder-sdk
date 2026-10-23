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
import { buildHash, parseHash } from '../utils/routing.ts';

test('editor route: prompt and JSON mode are preserved in the hash', () => {
  const promptRoute = { name: 'flow-edit' as const, flowId: 'abc', mode: 'prompt' as const };
  const jsonRoute = { name: 'flow-edit' as const, flowId: 'abc', mode: 'json' as const };

  assert.deepEqual(parseHash(buildHash(promptRoute)), promptRoute);
  assert.deepEqual(parseHash(buildHash(jsonRoute)), jsonRoute);
});

test('editor route: create flow defaults to prompt mode', () => {
  assert.deepEqual(parseHash('#/flows/new'), { name: 'flow-new', mode: 'prompt' });
});
