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
  isTransientFlowLoadError,
  retryTransientFlowLoad,
} from './flowLoad.ts';

test('isTransientFlowLoadError: recognizes not-found load failures', () => {
  assert.equal(isTransientFlowLoadError(new Error('Requested URL not found: /whatsapp/1/senders/x/flows/y')), true);
  assert.equal(isTransientFlowLoadError(new Error('Flow expired')), true);
  assert.equal(isTransientFlowLoadError(new Error('Validation failed')), false);
});

test('retryTransientFlowLoad: retries transient failures and returns the first success', async () => {
  let attempts = 0;
  const result = await retryTransientFlowLoad(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error('Requested URL not found: /whatsapp/1/senders/x/flows/y');
    }
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
});
