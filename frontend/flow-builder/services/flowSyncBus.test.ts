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
import { createFlowSyncBus, type FlowSyncEvent } from '../../shared.ts';

const created: FlowSyncEvent = {
  type: 'created',
  flow: { id: 'F1', name: 'Welcome', status: 'DRAFT', categories: ['OTHER'] },
};

test('a bus delivers its events to its own subscribers', () => {
  const bus = createFlowSyncBus();
  const heard: FlowSyncEvent[] = [];
  bus.subscribe((event) => heard.push(event));
  bus.publish(created);
  bus.publish({ type: 'deleted', id: 'F1' });
  assert.deepEqual(heard, [created, { type: 'deleted', id: 'F1' }]);
});

test('two buses are isolated: one instance never hears another', () => {
  const a = createFlowSyncBus();
  const b = createFlowSyncBus();
  const heardA: FlowSyncEvent[] = [];
  const heardB: FlowSyncEvent[] = [];
  a.subscribe((event) => heardA.push(event));
  b.subscribe((event) => heardB.push(event));

  a.publish(created);
  assert.deepEqual(heardA, [created]);
  assert.deepEqual(heardB, []);
});

test('unsubscribe stops delivery', () => {
  const bus = createFlowSyncBus();
  let calls = 0;
  const unsubscribe = bus.subscribe(() => calls++);
  bus.publish(created);
  unsubscribe();
  bus.publish(created);
  assert.equal(calls, 1);
});

test('the bus no longer lives on window', () => {
  const bus = createFlowSyncBus();
  bus.publish(created);
  const w = (globalThis as { window?: Record<string, unknown> }).window;
  assert.equal(w?.__fbFlowSyncBus, undefined);
});
