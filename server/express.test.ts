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

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createFlowBuilderRouter, type FlowBuilderRouterOptions } from './express.ts';

const BASE = 'https://acme.api.infobip.com';

type Call = { url: string; method: string; body: unknown; authorization: string | null };

function mockFetch(reply: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      authorization: new Headers(init?.headers).get('authorization'),
    };
    calls.push(call);
    const { status = 200, body = {} } = reply(call);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const servers: Array<{ close(): void }> = [];
after(() => { for (const server of servers) server.close(); });

// Start an Express app with the router mounted at `mount` on an ephemeral
// loopback port, and return its origin.
async function start(
  mount: string,
  options: Partial<FlowBuilderRouterOptions>,
  configure?: (app: express.Express) => void,
) {
  const app = express();
  configure?.(app);
  app.use(mount, createFlowBuilderRouter({
    baseUrl: BASE,
    apiKey: 'k-123',
    sender: '447000000000',
    authorize: () => true,
    logger: false,
    ...options,
  }));
  app.use((_req, res) => { res.status(404).type('text/plain').send('fallthrough'); });
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  const address = server.address() as { port: number };
  return `http://127.0.0.1:${address.port}`;
}

async function call(origin: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${origin}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep the text */ }
  return { status: res.status, body: parsed as any, type: res.headers.get('content-type') };
}

// Send the path exactly as given, without URL normalisation.
function rawRequest(origin: string, method: string, path: string) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const { hostname, port } = new URL(origin);
    const r = http.request({ hostname, port, method, path }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
    });
    r.on('error', reject);
    r.end();
  });
}

test('routes work under any mount path and fall through when unmatched', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { flows: [{ id: '1' }] } }));
  for (const mount of ['/api', '/tenant/flowbuilder/api']) {
    const origin = await start(mount, { fetch: fetchImpl });
    const listed = await call(origin, 'GET', `${mount}/flows?x=1`);
    assert.deepEqual(listed.body, { flows: [{ id: '1' }] });
    assert.equal(listed.status, 200);
    assert.match(listed.type ?? '', /application\/json/);
    assert.equal((await call(origin, 'GET', `${mount}/settings/api-key`)).body, 'fallthrough');
    assert.equal((await call(origin, 'GET', '/flows')).body, 'fallthrough');
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].authorization, 'App k-123');
});

test('JSON bodies are parsed per route and forwarded', async () => {
  const { fetchImpl, calls } = mockFetch((c) => c.method === 'POST' ? { body: { id: '77' } } : { body: { validationErrors: [] } });
  const origin = await start('/api', { fetch: fetchImpl, saveRetryDelays: [] });
  const flow = { version: '7.0', screens: [{ id: 'A' }] };
  const saved = await call(origin, 'POST', '/api/save-flow', { name: 'N', category: 'SURVEY', flow });
  assert.deepEqual(saved, {
    status: 200,
    type: saved.type,
    body: { id: '77', name: 'N', validationErrors: [], infobip: { id: '77' } },
  });
  assert.deepEqual(calls[1].body, flow);
});

test('flowId, prompt and update-flow validation match the old server', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: {} }));
  const origin = await start('/api', { fetch: fetchImpl });
  assert.deepEqual((await call(origin, 'GET', '/api/flow/a.b')).body, { error: 'Invalid flowId', code: 'INVALID_FLOW_ID' });
  assert.equal((await call(origin, 'GET', '/api/flow/a.b')).status, 400);
  assert.equal((await call(origin, 'DELETE', '/api/flow/a%2Fb')).status, 400);
  // `fetch` would normalise `%2E%2E` away, but a raw client can send it.
  assert.deepEqual(await rawRequest(origin, 'DELETE', '/api/flow/%2E%2E'), {
    status: 400, body: { error: 'Invalid flowId', code: 'INVALID_FLOW_ID' },
  });
  assert.equal((await call(origin, 'POST', '/api/generate-flow', {})).status, 400);
  assert.deepEqual((await call(origin, 'POST', '/api/generate-flow')).body, { error: 'prompt is required', code: 'BAD_REQUEST' });
  assert.equal((await call(origin, 'PUT', '/api/update-flow/1', [])).status, 400);
  assert.equal(calls.length, 0);
});

test('authorize gets the Express req, and its denial is a 403', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { flows: [] } }));
  const origin = await start('/api', {
    fetch: fetchImpl,
    authorize: (request, { req }) => (req as unknown as { user?: string }).user === 'ana'
      && request.headers.get('x-csrf') === null,
  }, (app) => {
    app.use((req, _res, next) => {
      if (req.query.as) (req as unknown as { user?: string }).user = String(req.query.as);
      next();
    });
  });
  assert.deepEqual(await call(origin, 'GET', '/api/flows?as=bob'), {
    status: 403, type: 'application/json; charset=utf-8', body: { error: 'Forbidden', code: 'FORBIDDEN' },
  });
  assert.equal((await call(origin, 'GET', '/api/flows?as=ana')).status, 200);
  assert.equal(calls.length, 1);
});

test('the body limit applies, and only after authorize', async () => {
  const { fetchImpl } = mockFetch(() => ({ body: {} }));
  const origin = await start('/api', { fetch: fetchImpl, bodyLimit: 1024 });
  const big = { prompt: 'x'.repeat(5000) };
  assert.deepEqual((await call(origin, 'POST', '/api/generate-flow', big)).body, {
    error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE',
  });
  assert.equal((await call(origin, 'POST', '/api/generate-flow', { prompt: 'ok' })).status, 200);

  const denied = await start('/api', { fetch: fetchImpl, bodyLimit: 1024, authorize: () => false });
  assert.equal((await call(denied, 'POST', '/api/generate-flow', big)).status, 403);
});

test('a body already parsed by app-level express.json() is reused', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { generatedFlow: {} } }));
  const origin = await start('/api', { fetch: fetchImpl }, (app) => app.use(express.json()));
  assert.equal((await call(origin, 'POST', '/api/generate-flow', { prompt: 'p' })).status, 200);
  assert.deepEqual(calls[0].body, { prompt: 'p' });
});

test('a pre-parsed URL-encoded body is ignored', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { generatedFlow: {} } }));
  const origin = await start('/api', { fetch: fetchImpl }, (app) => app.use(express.urlencoded({ extended: false })));
  const response = await fetch(`${origin}/api/generate-flow`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'prompt=not-json',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'prompt is required', code: 'BAD_REQUEST' });
  assert.equal(calls.length, 0);
});

test('upstream errors are redacted unless exposeUpstreamErrors is set', async () => {
  const upstream = { requestError: { serviceException: { text: 'Invalid login details' } } };
  const { fetchImpl } = mockFetch(() => ({ status: 401, body: upstream }));
  const redacted = await start('/api', { fetch: fetchImpl });
  assert.deepEqual(await call(redacted, 'GET', '/api/flows'), {
    status: 401, type: 'application/json; charset=utf-8', body: { error: 'Invalid login details', code: 'UPSTREAM_ERROR' },
  });
  const exposed = await start('/api', { fetch: fetchImpl, exposeUpstreamErrors: true });
  assert.deepEqual((await call(exposed, 'GET', '/api/flows')).body, {
    error: 'Invalid login details', code: 'UPSTREAM_ERROR', detail: upstream,
  });
});

test('getApiKey and getSender can read the Express request (multi-tenant)', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { flows: [] } }));
  const origin = await start('/t/:tenant/api', {
    fetch: fetchImpl,
    apiKey: undefined,
    sender: undefined,
    getApiKey: (_request, { req }) => `key-${(req as unknown as { params: { tenant: string } }).params.tenant}`,
    getSender: (request) => new URL(request.url).pathname.split('/')[2] === 'one' ? '111' : '222',
  });
  await call(origin, 'GET', '/t/one/api/flows');
  await call(origin, 'GET', '/t/two/api/flows');
  assert.deepEqual(calls.map((c) => [c.authorization, c.url]), [
    ['App key-one', `${BASE}/whatsapp/1/senders/111/flows`],
    ['App key-two', `${BASE}/whatsapp/1/senders/222/flows`],
  ]);
});
