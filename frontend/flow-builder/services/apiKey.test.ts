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
import { clearApiKey, getApiKeyStatus, maskApiKey, normalizeApiKey, setApiKey } from './apiKey.ts';

// Same fetch stub as whatsappFlows.test.ts — these calls go through `apiCall`.
function installFetch(handler: (url: string, init: RequestInit) => Promise<Response>): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => handler(String(input), init)) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const API = { apiBaseUrl: 'https://api.example.test/api' };

test('normalizeApiKey trims and drops a pasted `App ` scheme', () => {
  assert.equal(normalizeApiKey('  abc123  '), 'abc123');
  assert.equal(normalizeApiKey('App abc123'), 'abc123');
  assert.equal(normalizeApiKey('app   abc123'), 'abc123');
  assert.equal(normalizeApiKey('APP\tabc123'), 'abc123');
  assert.equal(normalizeApiKey(''), '');
});

test('normalizeApiKey leaves a key that merely starts with "app" alone', () => {
  assert.equal(normalizeApiKey('appleseed-key'), 'appleseed-key');
});

test('maskApiKey shows the last four characters, or dots alone without a hint', () => {
  assert.equal(maskApiKey('9f2c'), '••••••••9f2c');
  assert.equal(maskApiKey(''), '••••••••');
});

test('getApiKeyStatus reads the settings endpoint', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const restore = installFetch(async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET' });
    return jsonResponse({ source: 'override', hint: '9f2c' });
  });

  try {
    assert.deepEqual(await getApiKeyStatus(API), { source: 'override', hint: '9f2c' });
    assert.deepEqual(calls, [{ url: 'https://api.example.test/api/settings/api-key', method: 'GET' }]);
  } finally {
    restore();
  }
});

test('an unrecognized status payload falls back to the env source', async () => {
  const restore = installFetch(async () => jsonResponse({ source: 'nonsense' }));

  try {
    assert.deepEqual(await getApiKeyStatus(API), { source: 'env', hint: '' });
  } finally {
    restore();
  }
});

test('setApiKey PUTs the normalized key rather than the raw paste', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const restore = installFetch(async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : null });
    return jsonResponse({ source: 'override', hint: '9f2c' });
  });

  try {
    assert.deepEqual(await setApiKey('  App secret-9f2c ', API), { source: 'override', hint: '9f2c' });
    assert.deepEqual(calls, [
      {
        url: 'https://api.example.test/api/settings/api-key',
        method: 'PUT',
        body: '{"apiKey":"secret-9f2c"}',
      },
    ]);
  } finally {
    restore();
  }
});

test('setApiKey surfaces a rejection from the server', async () => {
  const restore = installFetch(async () => jsonResponse({ error: 'Infobip rejected that API key.' }, false, 401));

  try {
    await assert.rejects(() => setApiKey('bad-key', API), /Infobip rejected that API key\./);
  } finally {
    restore();
  }
});

test('clearApiKey DELETEs the override and reports the env key', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const restore = installFetch(async (url, init) => {
    calls.push({ url, method: init.method ?? 'GET' });
    return jsonResponse({ source: 'env', hint: 'abcd' });
  });

  try {
    assert.deepEqual(await clearApiKey(API), { source: 'env', hint: 'abcd' });
    assert.deepEqual(calls, [{ url: 'https://api.example.test/api/settings/api-key', method: 'DELETE' }]);
  } finally {
    restore();
  }
});
