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
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { apiCall, FlowBuilderApiError, type ApiOptions } from '../../api.ts';
import { ApiConfigProvider, useApiConfig } from '../app/apiConfig.tsx';
import { HostConfigProvider } from '../app/hostConfig.tsx';
import { InstanceProvider } from '../app/instanceContext.tsx';
import { fetchFlowPreview } from './flowPreview.ts';
import { createFlow, generateFlow, replaceFlowDefinition } from '../../services/whatsappFlows.ts';

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => '',
      blob: async () => new Blob(),
    } as unknown as Response;
  }) as typeof fetch;
}

test('apiCall merges getHeaders over Content-Type, using the custom fetch and credentials', async () => {
  const calls: Call[] = [];
  let headerCalls = 0;
  const options: ApiOptions = {
    apiBaseUrl: 'https://host.test/flowbuilder/',
    fetch: fakeFetch(200, { ok: true }, calls),
    credentials: 'include',
    getHeaders: async () => ({ Authorization: `Bearer ${++headerCalls}` }),
  };

  await apiCall(options, 'Thing', '/thing', 'POST', { a: 1 });
  await apiCall(options, 'Thing', '/thing', 'GET');

  assert.equal(calls[0].url, 'https://host.test/flowbuilder/thing');
  assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer 1' });
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.body, '{"a":1}');
  assert.equal((calls[1].init.headers as Record<string, string>).Authorization, 'Bearer 2');
});

test('apiCall falls back to the global fetch', async () => {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = fakeFetch(200, {}, calls);
  try {
    await apiCall(undefined, 'Thing', '/thing', 'GET');
    assert.equal(calls.length, 1);
    // No apiBaseUrl: the standalone server's `/api` mount.
    assert.equal(calls[0].url, '/api/thing');
  } finally {
    globalThis.fetch = original;
  }
});

test('apiCall throws FlowBuilderApiError with status and code, and calls onUnauthorized on 401', async () => {
  let unauthorized = 0;
  const options: ApiOptions = {
    fetch: fakeFetch(401, { error: 'Nope', code: 'UNAUTHORIZED' }),
    onUnauthorized: () => { unauthorized += 1; },
  };
  await assert.rejects(
    () => apiCall(options, 'Thing', '/thing', 'GET'),
    (error: unknown) => {
      assert.ok(error instanceof FlowBuilderApiError);
      assert.equal(error.message, 'Nope');
      assert.equal(error.status, 401);
      assert.equal(error.code, 'UNAUTHORIZED');
      return true;
    },
  );
  assert.equal(unauthorized, 1);
});

test('apiCall keeps the default message when the body has no error', async () => {
  await assert.rejects(
    () => apiCall({ fetch: fakeFetch(500, {}) }, 'Thing', '/thing', 'GET'),
    (error: unknown) => error instanceof FlowBuilderApiError
      && error.message === 'Thing failed (HTTP 500)' && error.status === 500 && error.code === undefined,
  );
});

test('apiCall reports errors to onError but not aborts', async () => {
  const seen: unknown[] = [];
  const failing: ApiOptions = { fetch: fakeFetch(500, { error: 'Boom' }), onError: (e) => seen.push(e) };
  await assert.rejects(() => apiCall(failing, 'Thing', '/thing', 'GET'));
  assert.equal(seen.length, 1);

  const aborting: ApiOptions = {
    fetch: (async () => { throw new DOMException('Aborted', 'AbortError'); }) as typeof fetch,
    onError: (e) => seen.push(e),
  };
  await assert.rejects(() => apiCall(aborting, 'Thing', '/thing', 'GET'));
  assert.equal(seen.length, 1);
});

test('fetchFlowPreview goes through the injected fetch, headers and credentials', async () => {
  const calls: Call[] = [];
  const result = await fetchFlowPreview('FLOW_1', {
    apiBaseUrl: 'https://host.test/api',
    fetch: fakeFetch(200, { previewUrl: 'https://example.test/p' }, calls),
    credentials: 'include',
    getHeaders: () => ({ 'X-Host': '1' }),
  });
  assert.equal(result.status, 'ready');
  assert.equal(calls[0].url, 'https://host.test/api/flow-preview/FLOW_1');
  assert.equal(calls[0].init.credentials, 'include');
  assert.deepEqual(calls[0].init.headers, {
    Accept: 'application/json, image/*, application/octet-stream',
    'X-Host': '1',
  });
});

test('flow service functions hit the flow routes under the default /api mount', async () => {
  const calls: Call[] = [];
  const options: ApiOptions = { fetch: fakeFetch(200, { id: 'F' }, calls) };
  const flow = { version: '7.0', screens: [] } as never;
  await generateFlow('hi', 'R1', options);
  await createFlow({ name: 'n', category: 'OTHER', flow } as never, options);
  await replaceFlowDefinition('F', flow, options);
  assert.deepEqual(calls.map((c) => `${c.init.method} ${c.url}`), [
    'POST /api/generate-flow',
    'POST /api/save-flow',
    'PUT /api/update-flow/F',
  ]);
});

test('ApiConfigProvider forwards API failures to the host onError with source "api"', async () => {
  const reported: Array<[unknown, unknown]> = [];
  let config: ApiOptions | undefined;
  function Probe() {
    config = useApiConfig();
    return null;
  }
  renderToStaticMarkup(
    createElement(
      InstanceProvider,
      null,
      createElement(
        HostConfigProvider,
        { onError: (error: unknown, info: unknown) => { reported.push([error, info]); } },
        createElement(ApiConfigProvider, { fetch: fakeFetch(500, { error: 'Boom' }) }, createElement(Probe)),
      ),
    ),
  );
  assert.ok(config);
  await assert.rejects(() => apiCall(config, 'Thing', '/thing', 'GET'));
  assert.equal(reported.length, 1);
  assert.deepEqual(reported[0][1], { source: 'api' });
});
