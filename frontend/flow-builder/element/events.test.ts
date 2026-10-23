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
import { createEventCallbacks, ELEMENT_EVENTS } from './events.ts';

test('every lifecycle callback dispatches its flowbuilder:* event with a detail object', () => {
  const seen: Array<[string, unknown]> = [];
  const cb = createEventCallbacks((name, detail) => seen.push([name, detail]));
  const flow = { id: 'F1', name: 'n', status: 'DRAFT', categories: [] } as never;

  cb.onFlowCreated(flow);
  cb.onFlowSaved(flow);
  cb.onFlowPublished(flow);
  cb.onFlowDeleted('F1');
  const err = new Error('x');
  cb.onError(err, { source: 'api' });
  cb.onNavigate({ name: 'settings' });

  assert.deepEqual(seen, [
    ['flowbuilder:created', { flow }],
    ['flowbuilder:saved', { flow }],
    ['flowbuilder:published', { flow }],
    ['flowbuilder:deleted', { flowId: 'F1' }],
    ['flowbuilder:error', { error: err, source: 'api' }],
    ['flowbuilder:navigate', { route: { name: 'settings' } }],
  ]);
});

test('event names are unique and namespaced', () => {
  const names = Object.values(ELEMENT_EVENTS);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.every((n) => n.startsWith('flowbuilder:')));
});
