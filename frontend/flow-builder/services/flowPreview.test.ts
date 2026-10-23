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
import { fetchFlowPreview } from './flowPreview.ts';

test('fetchFlowPreview retries blank preview URLs until the iframe URL is ready', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let attempts = 0;
  const delays: number[] = [];

  globalThis.fetch = (async () => {
    attempts += 1;
    const previewUrl = attempts < 3 ? '   ' : 'https://example.test/preview';
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ previewUrl }),
      text: async () => '',
      blob: async () => new Blob(),
    } as unknown as Response;
  }) as typeof fetch;

  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    delays.push(Number(timeout ?? 0));
    if (typeof handler === 'function') {
      handler(...args);
    }
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalThis.clearTimeout = originalClearTimeout;

  try {
    const result = await fetchFlowPreview('FLOW_1', { apiBaseUrl: 'https://api.example.test/api' });
    assert.equal(result.status, 'ready');
    assert.equal(result.kind, 'iframe');
    assert.equal(result.url, 'https://example.test/preview');
    assert.equal(attempts, 3);
    assert.deepEqual(delays.slice(0, 2), [1000, 2000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
