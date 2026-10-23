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
import { deleteFlow, publishFlow } from '../../services/whatsappFlows.ts';

function installFetch(handler: (url: string, init: RequestInit) => Promise<Response>): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => handler(String(input), init)) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('deleteFlow sends a DELETE request to the flow endpoint', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const restore = installFetch(async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : null });
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ id: 'FLOW_1', status: 'DELETED' }),
      text: async () => JSON.stringify({ id: 'FLOW_1', status: 'DELETED' }),
    } as unknown as Response;
  });

  try {
    const result = await deleteFlow('FLOW_1', { apiBaseUrl: 'https://api.example.test/api' });
    assert.deepEqual(result, { id: 'FLOW_1', status: 'DELETED' });
    assert.deepEqual(calls, [{ url: 'https://api.example.test/api/flow/FLOW_1', method: 'DELETE', body: null }]);
  } finally {
    restore();
  }
});

test('publishFlow sends the flow id in the request body', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const restore = installFetch(async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : null });
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ id: 'FLOW_2', status: 'PUBLISHED' }),
      text: async () => JSON.stringify({ id: 'FLOW_2', status: 'PUBLISHED' }),
    } as unknown as Response;
  });

  try {
    const result = await publishFlow('FLOW_2', { apiBaseUrl: 'https://api.example.test/api' });
    assert.deepEqual(result, { id: 'FLOW_2', status: 'PUBLISHED' });
    assert.deepEqual(calls, [{ url: 'https://api.example.test/api/publish-flow', method: 'POST', body: '{"flowId":"FLOW_2"}' }]);
  } finally {
    restore();
  }
});

test('deleteFlow surfaces backend errors', async () => {
  const restore = installFetch(async () => ({
    ok: false,
    status: 400,
    headers: { get: () => 'application/json' },
    json: async () => ({ error: 'Cannot delete flow which is not in DRAFT status.' }),
    text: async () => JSON.stringify({ error: 'Cannot delete flow which is not in DRAFT status.' }),
  } as unknown as Response));

  try {
    await assert.rejects(
      () => deleteFlow('FLOW_3', { apiBaseUrl: 'https://api.example.test/api' }),
      /Cannot delete flow which is not in DRAFT status\./,
    );
  } finally {
    restore();
  }
});
