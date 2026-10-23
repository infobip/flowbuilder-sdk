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
import { createFlowJsonCache } from './flowJsonCache.ts';

// Stub fetch, counting downloads per flow id. `downloadFlowJson` goes through
// `apiCall`, the same path whatsappFlows.test.ts stubs.
function installFetch(respond: (url: string) => unknown | null): { calls: string[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const body = respond(url);
    return {
      ok: body != null,
      status: body != null ? 200 : 500,
      headers: { get: () => 'application/json' },
      json: async () => body ?? { error: 'boom' },
      text: async () => JSON.stringify(body ?? { error: 'boom' }),
    } as unknown as Response;
  }) as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = originalFetch) };
}

const FLOW = { version: '7.0', screens: [{ id: 'WELCOME', title: 'Hi', terminal: true, layout: { type: 'SingleColumnLayout', children: [] } }] };
const API = { apiBaseUrl: 'https://api.example.test/api' };

test('a cache fetches each flow once and memoises it', async () => {
  const { calls, restore } = installFetch(() => FLOW);
  try {
    const cache = createFlowJsonCache();
    const [first, second] = await Promise.all([cache.get('F1', API), cache.get('F1', API)]);
    assert.ok(first);
    assert.equal(first, second);
    await cache.get('F1', API);
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test('two caches are isolated: each fetches for itself and clearing one keeps the other', async () => {
  const { calls, restore } = installFetch(() => FLOW);
  try {
    const a = createFlowJsonCache();
    const b = createFlowJsonCache();
    await a.get('F1', API);
    await b.get('F1', API);
    assert.equal(calls.length, 2);

    a.clear();
    await b.get('F1', API);
    assert.equal(calls.length, 2, 'b still has its copy');
    await a.get('F1', API);
    assert.equal(calls.length, 3, 'a refetches after its clear');
  } finally {
    restore();
  }
});

test('a failed fetch resolves to null and is retried on the next request', async () => {
  let fail = true;
  const { calls, restore } = installFetch(() => (fail ? null : FLOW));
  try {
    const cache = createFlowJsonCache();
    assert.equal(await cache.get('F1', API), null);
    fail = false;
    // Let the null-eviction `.then` run.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(await cache.get('F1', API));
    assert.equal(calls.length, 2);
  } finally {
    restore();
  }
});
