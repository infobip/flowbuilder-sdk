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
import { createFlowBuilderHandler, type FlowBuilderHandlerOptions, type FlowBuilderLogEntry } from './core.ts';

const BASE = 'https://acme.api.infobip.com';
const FLOWS = `${BASE}/whatsapp/1/senders/447000000000/flows`;

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;
type Responder = (call: Call) => Reply;

// A fake `fetch` that records every call and answers from `responder`.
function mockFetch(responder: Responder) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => { headers[name] = value; });
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const reply = responder(call);
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    const text = reply.body === undefined ? '' : typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return new Response(status === 204 || status === 304 ? null : text, { status, headers: reply.headers });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function setup(responder: Responder, overrides: Partial<FlowBuilderHandlerOptions> = {}) {
  const { fetchImpl, calls } = mockFetch(responder);
  const logs: FlowBuilderLogEntry[] = [];
  const handler = createFlowBuilderHandler({
    baseUrl: BASE,
    apiKey: 'secret-key-0001',
    sender: '447000000000',
    authorize: () => true,
    fetch: fetchImpl,
    logger: (entry) => logs.push(entry),
    saveRetryDelays: [1, 1, 1],
    ...overrides,
  });
  return { handler, calls, logs };
}

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] ??= 'application/json';
  }
  return new Request(`http://app.local${path}`, init);
}

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

const infobipError = (status: number, text: string) => ({
  status,
  body: { requestError: { serviceException: { messageId: 'BAD', text } } },
});

// ── Construction ───────────────────────────────────────────────────

test('construction requires authorize, baseUrl, a key and a sender', () => {
  const base = { baseUrl: BASE, apiKey: 'k', sender: 's', authorize: () => true };
  assert.throws(() => createFlowBuilderHandler({ ...base, authorize: undefined } as never), /authorize/);
  assert.throws(() => createFlowBuilderHandler({ ...base, baseUrl: 'not a url' }), /baseUrl/);
  assert.throws(() => createFlowBuilderHandler({ ...base, apiKey: undefined }), /apiKey/);
  assert.throws(() => createFlowBuilderHandler({ ...base, sender: undefined }), /sender/);
  assert.throws(() => createFlowBuilderHandler({ ...base, bodyLimit: 'lots' }), /body size/);
  assert.doesNotThrow(() => createFlowBuilderHandler(base));
  assert.doesNotThrow(() => createFlowBuilderHandler({ ...base, apiKey: undefined, getApiKey: () => 'k' }));
  assert.doesNotThrow(() => createFlowBuilderHandler({ ...base, sender: undefined, getSender: () => 's' }));
});

test('baseUrl requires HTTPS except for local loopback mocks', () => {
  const options = { baseUrl: BASE, apiKey: 'k', sender: 's', authorize: () => true };

  assert.throws(() => createFlowBuilderHandler({ ...options, baseUrl: 'http://api.example.test' }), /HTTPS/);
  assert.doesNotThrow(() => createFlowBuilderHandler(options));
  for (const baseUrl of ['http://localhost:4100', 'http://127.0.0.1:4100', 'http://[::1]:4100']) {
    assert.doesNotThrow(() => createFlowBuilderHandler({ ...options, baseUrl }), baseUrl);
  }
});

// ── Happy paths ────────────────────────────────────────────────────

test('GET /flows lists the sender\'s flows with the App key', async () => {
  const { handler, calls } = setup(() => ({ body: { flows: [{ id: '1', name: 'A' }] } }));
  const res = await json(await handler(req('GET', '/flows')));
  assert.deepEqual(res, { status: 200, body: { flows: [{ id: '1', name: 'A' }] } });
  assert.equal(calls[0].url, FLOWS);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers.authorization, 'App secret-key-0001');
  assert.equal(calls[0].body, undefined);
});

test('an `App ` prefix on the configured key is not doubled', async () => {
  const { handler, calls } = setup(() => ({ body: { flows: [] } }), { apiKey: 'App secret-key-0001' });
  await handler(req('GET', '/flows'));
  assert.equal(calls[0].headers.authorization, 'App secret-key-0001');
});

test('POST /generate-flow forwards the prompt and responseId', async () => {
  const { handler, calls } = setup(() => ({ body: { generatedFlow: { version: '7.0' }, responseId: 'r2' } }));
  const res = await json(await handler(req('POST', '/generate-flow', { prompt: 'Booking', responseId: 'r1' })));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { flow: { version: '7.0' }, responseId: 'r2', infobip: { generatedFlow: { version: '7.0' }, responseId: 'r2' } });
  assert.equal(calls[0].url, `${FLOWS}/generate`);
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, { prompt: 'Booking', responseId: 'r1' });
});

test('POST /generate-flow omits responseId when not given, and falls back to `flow`', async () => {
  const { handler, calls } = setup(() => ({ body: { flow: { version: '7.0' }, requestId: 'q1' } }));
  const res = await json(await handler(req('POST', '/generate-flow', { prompt: 'Booking' })));
  assert.deepEqual(res.body.flow, { version: '7.0' });
  assert.equal(res.body.responseId, 'q1');
  assert.deepEqual(calls[0].body, { prompt: 'Booking' });
});

test('POST /generate-flow without a prompt is a 400 and calls nothing upstream', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  assert.deepEqual(await json(await handler(req('POST', '/generate-flow', {}))), {
    status: 400, body: { error: 'prompt is required', code: 'BAD_REQUEST' },
  });
  assert.deepEqual(await json(await handler(req('POST', '/generate-flow'))), {
    status: 400, body: { error: 'prompt is required', code: 'BAD_REQUEST' },
  });
  assert.equal(calls.length, 0);
});

test('POST /save-flow creates the shell, then uploads the JSON', async () => {
  const { handler, calls } = setup((call) => call.method === 'POST'
    ? { body: { id: '1706281277038270' } }
    : { body: { validationErrors: [{ error: 'warn' }] } });
  const flow = { version: '7.0', screens: [] };
  const res = await json(await handler(req('POST', '/save-flow', { name: 'Booking', category: 'SURVEY', flow, responseId: 'r1' })));
  assert.deepEqual(res, {
    status: 200,
    body: {
      id: '1706281277038270',
      name: 'Booking##r1',
      responseId: 'r1',
      validationErrors: [{ error: 'warn' }],
      infobip: { id: '1706281277038270' },
    },
  });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
    `POST ${FLOWS}`,
    `PUT ${FLOWS}/1706281277038270/json`,
  ]);
  assert.deepEqual(calls[0].body, { name: 'Booking##r1', categories: ['SURVEY'] });
  assert.deepEqual(calls[1].body, flow);
});

test('POST /save-flow keeps the responseId when the name is too long', async () => {
  const { handler, calls } = setup((call) => call.method === 'POST' ? { body: { id: '9' } } : { body: {} });
  const res = await json(await handler(req('POST', '/save-flow', { name: 'x'.repeat(300), category: 'SURVEY', flow: { a: 1 }, responseId: 'rid' })));
  assert.equal(res.body.name.length, 200);
  assert.ok(res.body.name.endsWith('##rid'));
  assert.equal((calls[0].body as { name: string }).name, res.body.name);
});

test('POST /save-flow requires name, category and flow', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  const res = await json(await handler(req('POST', '/save-flow', { name: 'x', category: 'SURVEY' })));
  assert.deepEqual(res, { status: 400, body: { error: 'name, category, and flow are required', code: 'BAD_REQUEST' } });
  assert.equal(calls.length, 0);
});

test('POST /save-flow retries the upload while Infobip indexes the new flow', async () => {
  let puts = 0;
  const { handler, calls } = setup((call) => {
    if (call.method === 'POST') return { body: { id: '42' } };
    puts += 1;
    return puts < 3 ? infobipError(404, 'Flow not found') : { body: { validationErrors: [] } };
  });
  const res = await json(await handler(req('POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } })));
  assert.equal(res.status, 200);
  assert.equal(res.body.id, '42');
  assert.equal(calls.filter((c) => c.method === 'PUT').length, 3);
});

test('POST /save-flow gives up with a 503 once the retries run out', async () => {
  const { handler, calls } = setup((call) => call.method === 'POST' ? { body: { id: '42' } } : infobipError(404, 'Flow not found'));
  const res = await json(await handler(req('POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } })));
  assert.deepEqual(res, {
    status: 503,
    body: {
      error: 'Flow was created but is still being indexed by Infobip. Try saving again in a few seconds.',
      code: 'FLOW_STILL_INDEXING',
    },
  });
  // One first try plus one per configured delay.
  assert.equal(calls.filter((c) => c.method === 'PUT').length, 4);
});

test('POST /save-flow does not retry errors other than 404', async () => {
  const { handler, calls } = setup((call) => call.method === 'POST' ? { body: { id: '42' } } : infobipError(400, 'Bad JSON'));
  const res = await json(await handler(req('POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } })));
  assert.deepEqual(res, { status: 400, body: { error: 'Bad JSON', code: 'UPSTREAM_ERROR' } });
  assert.equal(calls.filter((c) => c.method === 'PUT').length, 1);
});

test('POST /save-flow refuses an id from Infobip that is not a flow id', async () => {
  const { handler, calls } = setup(() => ({ body: { id: '../../other' } }));
  const res = await json(await handler(req('POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } })));
  assert.equal(res.status, 502);
  assert.equal(res.body.code, 'UPSTREAM_INVALID_RESPONSE');
  assert.equal(calls.length, 1);
});

test('PUT /update-flow/:flowId uploads the JSON', async () => {
  const { handler, calls } = setup(() => ({ body: { validationErrors: ['v'] } }));
  const res = await json(await handler(req('PUT', '/update-flow/abc_1-2', { version: '7.0' })));
  assert.deepEqual(res, { status: 200, body: { id: 'abc_1-2', validationErrors: ['v'], infobip: { validationErrors: ['v'] } } });
  assert.equal(calls[0].url, `${FLOWS}/abc_1-2/json`);
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual(calls[0].body, { version: '7.0' });
});

test('PUT /update-flow/:flowId and PUT /flow/:flowId/json reject arrays, {} and no body', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  for (const path of ['/update-flow/1', '/flow/1/json']) {
    for (const body of [[], {}, [1, 2], undefined, '"text"', '42']) {
      const res = await json(await handler(req('PUT', path, body)));
      assert.deepEqual(res, { status: 400, body: { error: 'flow JSON body is required', code: 'BAD_REQUEST' } }, `${path} ${JSON.stringify(body)}`);
    }
  }
  assert.equal(calls.length, 0);
});

test('PUT /flow/:flowId/json uploads the JSON', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  const res = await json(await handler(req('PUT', '/flow/7/json', { version: '7.0' })));
  assert.deepEqual(res, { status: 200, body: { id: '7', validationErrors: [], infobip: {} } });
  assert.equal(calls[0].url, `${FLOWS}/7/json`);
});

test('GET /flow/:flowId/json downloads from the URL Infobip returns, without the key', async () => {
  const download = 'https://files.infobip.com/flows/7.json?sig=abc';
  const { handler, calls } = setup((call) => call.url === download
    ? { body: { version: '7.0', screens: [] } }
    : { body: { externalDownloadUrl: download } });
  const res = await json(await handler(req('GET', '/flow/7/json')));
  assert.deepEqual(res, { status: 200, body: { version: '7.0', screens: [] } });
  assert.equal(calls[0].url, `${FLOWS}/7/json`);
  assert.equal(calls[1].url, download);
  assert.equal(calls[1].headers.authorization, undefined);
});

test('GET /flow/:flowId/json resolves a relative download URL against baseUrl', async () => {
  const { handler, calls } = setup((call) => call.url.endsWith('/dl/7')
    ? { body: { version: '7.0' } }
    : { body: { downloadUrl: '/dl/7' } });
  const res = await json(await handler(req('GET', '/flow/7/json')));
  assert.equal(res.status, 200);
  assert.equal(calls[1].url, `${BASE}/dl/7`);
});

test('GET /flow/:flowId/json is a 502 when Infobip returns no download URL', async () => {
  const { handler } = setup(() => ({ body: { something: 'else' } }));
  assert.deepEqual(await json(await handler(req('GET', '/flow/7/json'))), {
    status: 502, body: { error: 'externalDownloadUrl is missing', code: 'DOWNLOAD_URL_MISSING' },
  });
});

test('GET /flow/:flowId/json maps a failed download', async () => {
  const { handler } = setup((call) => call.url.includes('files.')
    ? { status: 403, body: '<Error>AccessDenied</Error>' }
    : { body: { externalDownloadUrl: 'https://files.infobip.com/x' } });
  assert.deepEqual(await json(await handler(req('GET', '/flow/7/json'))), {
    status: 403, body: { error: 'HTTP 403', code: 'UPSTREAM_ERROR' },
  });
});

test('PATCH /update-flow/:flowId sends only a trimmed name and non-empty categories', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  const res = await json(await handler(req('PATCH', '/update-flow/5', { name: '  New  ', categories: [], other: 1 })));
  assert.deepEqual(res, { status: 200, body: { id: '5', validationErrors: [], infobip: {} } });
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].url, `${FLOWS}/5`);
  assert.deepEqual(calls[0].body, { name: 'New' });

  await handler(req('PATCH', '/update-flow/5', { categories: ['SURVEY'] }));
  assert.deepEqual(calls[1].body, { categories: ['SURVEY'] });
});

test('PATCH /update-flow/:flowId without a name or categories is a 400', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  assert.deepEqual(await json(await handler(req('PATCH', '/update-flow/5', { name: '  ' }))), {
    status: 400, body: { error: 'name or categories are required', code: 'BAD_REQUEST' },
  });
  assert.equal(calls.length, 0);
});

test('GET /flow-preview/:flowId returns Infobip\'s preview', async () => {
  const preview = { previewUrl: 'https://flow.infobip.com/preview/1', expiresAt: '2030-01-01T00:00:00Z' };
  const { handler, calls } = setup(() => ({ body: preview }));
  assert.deepEqual(await json(await handler(req('GET', '/flow-preview/9'))), { status: 200, body: preview });
  assert.equal(calls[0].url, `${FLOWS}/9/preview`);
});

test('POST /publish-flow publishes the flow in the body', async () => {
  const { handler, calls } = setup(() => ({ body: { id: '9', status: 'PUBLISHED' } }));
  assert.deepEqual(await json(await handler(req('POST', '/publish-flow', { flowId: '9' }))), {
    status: 200, body: { id: '9', status: 'PUBLISHED' },
  });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, `${FLOWS}/9/publish`);
  assert.equal(calls[0].body, undefined);
});

test('POST /publish-flow validates flowId', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  assert.deepEqual(await json(await handler(req('POST', '/publish-flow', {}))), {
    status: 400, body: { error: 'flowId is required', code: 'BAD_REQUEST' },
  });
  for (const flowId of ['../1', '1/publish', 'a b', 12, { id: 1 }]) {
    assert.deepEqual(await json(await handler(req('POST', '/publish-flow', { flowId }))), {
      status: 400, body: { error: 'Invalid flowId', code: 'INVALID_FLOW_ID' },
    }, JSON.stringify(flowId));
  }
  assert.equal(calls.length, 0);
});

test('GET /flow/:flowId picks the flow out of the list', async () => {
  const { handler, calls } = setup(() => ({ body: { flows: [{ id: '1' }, { id: '2', name: 'Two' }] } }));
  assert.deepEqual(await json(await handler(req('GET', '/flow/2'))), { status: 200, body: { id: '2', name: 'Two' } });
  assert.equal(calls[0].url, FLOWS);
});

test('GET /flow/:flowId is a 404 the frontend recognises when the flow is not listed', async () => {
  const { handler } = setup(() => ({ body: { flows: [{ id: '1' }] } }));
  assert.deepEqual(await json(await handler(req('GET', '/flow/3'))), {
    status: 404,
    body: { error: 'Requested URL not found: /whatsapp/1/senders/447000000000/flows/3', code: 'NOT_FOUND' },
  });
});

test('DELETE /flow/:flowId acknowledges even an empty Infobip body', async () => {
  const { handler, calls } = setup(() => ({ status: 204 }));
  assert.deepEqual(await json(await handler(req('DELETE', '/flow/3'))), {
    status: 200, body: { id: '3', status: 'DELETED', infobip: {} },
  });
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url, `${FLOWS}/3`);
});

// ── Upstream error mapping ─────────────────────────────────────────

const ROUTES: Array<[string, string, unknown?]> = [
  ['GET', '/flows'],
  ['POST', '/generate-flow', { prompt: 'p' }],
  ['POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } }],
  ['PUT', '/update-flow/1', { a: 1 }],
  ['GET', '/flow/1/json'],
  ['PUT', '/flow/1/json', { a: 1 }],
  ['PATCH', '/update-flow/1', { name: 'n' }],
  ['GET', '/flow-preview/1'],
  ['POST', '/publish-flow', { flowId: '1' }],
  ['GET', '/flow/1'],
  ['DELETE', '/flow/1'],
];

test('every route passes Infobip\'s status and message through', async () => {
  for (const [method, path, body] of ROUTES) {
    const { handler } = setup(() => infobipError(401, 'Invalid login details'));
    assert.deepEqual(await json(await handler(req(method, path, body))), {
      status: 401, body: { error: 'Invalid login details', code: 'UPSTREAM_ERROR' },
    }, `${method} ${path}`);
  }
});

test('an Infobip error without a message becomes "HTTP <status>"', async () => {
  const { handler } = setup(() => ({ status: 502, body: 'Bad gateway' }));
  assert.deepEqual(await json(await handler(req('GET', '/flows'))), {
    status: 502, body: { error: 'HTTP 502', code: 'UPSTREAM_ERROR' },
  });
});

test('an unreachable Infobip is a 500 with the network error message', async () => {
  for (const [method, path, body] of ROUTES) {
    const { handler } = setup(() => new TypeError('fetch failed'));
    assert.deepEqual(await json(await handler(req(method, path, body))), {
      status: 500, body: { error: 'fetch failed', code: 'UPSTREAM_UNREACHABLE' },
    }, `${method} ${path}`);
  }
});

// ── Redaction ──────────────────────────────────────────────────────

test('upstream detail is redacted by default and shown with exposeUpstreamErrors', async () => {
  const upstream = infobipError(400, 'Bad request');

  const redacted = setup(() => upstream);
  const hidden = await json(await redacted.handler(req('GET', '/flows')));
  assert.deepEqual(hidden.body, { error: 'Bad request', code: 'UPSTREAM_ERROR' });

  const exposed = setup(() => upstream, { exposeUpstreamErrors: true });
  const shown = await json(await exposed.handler(req('GET', '/flows')));
  assert.deepEqual(shown.body, { error: 'Bad request', code: 'UPSTREAM_ERROR', detail: upstream.body });

  // The 404 hydration miss and the indexing 503 carry detail too.
  const listed = { flows: [{ id: '1' }] };
  const miss = setup(() => ({ body: listed }), { exposeUpstreamErrors: true });
  assert.deepEqual((await json(await miss.handler(req('GET', '/flow/2')))).body.detail, listed);
  const indexing = setup((c) => c.method === 'POST' ? { body: { id: '1' } } : infobipError(404, 'nf'), { exposeUpstreamErrors: true });
  const res = await json(await indexing.handler(req('POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } })));
  assert.equal(res.status, 503);
  assert.deepEqual(res.body.detail, infobipError(404, 'nf').body);
});

// ── Authorization ──────────────────────────────────────────────────

test('authorize denial is a 403 before anything reaches Infobip', async () => {
  for (const verdict of [false, undefined, 'yes', 1]) {
    const { handler, calls } = setup(() => ({ body: {} }), { authorize: () => verdict as boolean });
    for (const [method, path, body] of ROUTES) {
      assert.deepEqual(await json(await handler(req(method, path, body))), {
        status: 403, body: { error: 'Forbidden', code: 'FORBIDDEN' },
      }, `${String(verdict)} ${method} ${path}`);
    }
    assert.equal(calls.length, 0);
  }
});

test('authorize sees the request, may be async, and may answer with its own Response', async () => {
  const { handler, calls } = setup(() => ({ body: { flows: [] } }), {
    authorize: async (request) => request.headers.get('authorization') === 'Bearer ok'
      || new Response('{"error":"login"}', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }),
  });
  const denied = await handler(req('GET', '/flows'));
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('www-authenticate'), 'Bearer');
  assert.equal((await handler(req('GET', '/flows', undefined, { authorization: 'Bearer ok' }))).status, 200);
  assert.equal(calls.length, 1);
});

test('authorize runs before the body is read, so denied requests never hit the limit', async () => {
  const { handler } = setup(() => ({ body: {} }), { authorize: () => false, bodyLimit: 10 });
  assert.equal((await handler(req('POST', '/generate-flow', { prompt: 'x'.repeat(100) }))).status, 403);
});

test('a throwing authorize is a 500 that hides the error', async () => {
  const { handler, calls } = setup(() => ({ body: {} }), { authorize: () => { throw new Error('db down: password=hunter2'); } });
  assert.deepEqual(await json(await handler(req('GET', '/flows'))), {
    status: 500, body: { error: 'Authorization check failed', code: 'AUTHORIZATION_ERROR' },
  });
  assert.equal(calls.length, 0);
});

// ── flowId validation ──────────────────────────────────────────────

test('a flowId path param that is not [A-Za-z0-9_-]+ is a 400', async () => {
  const { handler, calls } = setup(() => ({ body: {} }));
  for (const bad of ['a%2Fb', 'a.b', '%3Fx', 'a%20b', '%E0%A4%A', '..%2F..%2Fother']) {
    for (const [method, path, body] of [
      ['GET', `/flow/${bad}`],
      ['GET', `/flow/${bad}/json`],
      ['PUT', `/flow/${bad}/json`, { a: 1 }],
      ['PUT', `/update-flow/${bad}`, { a: 1 }],
      ['PATCH', `/update-flow/${bad}`, { name: 'n' }],
      ['GET', `/flow-preview/${bad}`],
      ['DELETE', `/flow/${bad}`],
    ] as Array<[string, string, unknown?]>) {
      assert.deepEqual(await json(await handler(req(method, path, body))), {
        status: 400, body: { error: 'Invalid flowId', code: 'INVALID_FLOW_ID' },
      }, `${method} ${path}`);
    }
  }
  // `%2E%2E` is a `..` segment to the WHATWG URL parser, which resolves it
  // before the handler sees the path, so it simply matches no route.
  assert.equal((await handler(req('GET', '/flow/%2E%2E'))).status, 404);
  assert.equal(calls.length, 0);
});

// ── Body limit and parsing ─────────────────────────────────────────

test('bodies over bodyLimit are a 413', async () => {
  const { handler, calls } = setup(() => ({ body: {} }), { bodyLimit: '1kb' });
  const big = { prompt: 'x'.repeat(2000) };
  assert.deepEqual(await json(await handler(req('POST', '/generate-flow', big))), {
    status: 413, body: { error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' },
  });

  // Also without a Content-Length header (streamed body).
  const encoded = new TextEncoder().encode(JSON.stringify(big));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < encoded.length; i += 256) controller.enqueue(encoded.slice(i, i + 256));
      controller.close();
    },
  });
  const streamed = new Request('http://app.local/generate-flow', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
  } as RequestInit);
  assert.equal((await handler(streamed)).status, 413);

  assert.equal((await handler(req('POST', '/generate-flow', { prompt: 'small' }))).status, 200);
  assert.equal(calls.length, 1);
});

test('the default body limit is 5 MB', async () => {
  const { handler } = setup(() => ({ body: {} }));
  const res = await handler(req('PUT', '/flow/1/json', { blob: 'x'.repeat(5 * 1024 * 1024) }));
  assert.equal(res.status, 413);
  assert.equal((await handler(req('PUT', '/flow/1/json', { blob: 'x'.repeat(4 * 1024 * 1024) }))).status, 200);
});

test('malformed JSON is a 400, and non-JSON bodies are ignored', async () => {
  const { handler } = setup(() => ({ body: {} }));
  assert.deepEqual(await json(await handler(req('POST', '/generate-flow', '{"prompt":'))), {
    status: 400, body: { error: 'Request body is not valid JSON', code: 'INVALID_JSON' },
  });
  const textBody = await handler(req('POST', '/generate-flow', '{"prompt":"p"}', { 'content-type': 'text/plain' }));
  assert.deepEqual(await json(textBody), { status: 400, body: { error: 'prompt is required', code: 'BAD_REQUEST' } });
});

// ── Download host allowlist ────────────────────────────────────────

test('the flow JSON download is refused for hosts outside the allowlist', async () => {
  for (const url of [
    'https://evil.example.com/x.json',
    'http://169.254.169.254/latest/meta-data',
    'https://infobip.com.evil.net/x',
    'http://files.infobip.com/x', // https only for an https baseUrl
    'file:///etc/passwd',
  ]) {
    const { handler, calls } = setup(() => ({ body: { externalDownloadUrl: url } }));
    const res = await json(await handler(req('GET', '/flow/1/json')));
    assert.equal(res.status, 502, url);
    assert.equal(res.body.code, 'DOWNLOAD_HOST_NOT_ALLOWED', url);
    assert.equal(calls.length, 1, url);
  }
});

test('the download allowlist accepts the baseUrl host, *.infobip.com and WhatsApp media hosts by default', async () => {
  for (const url of [
    `${BASE}/files/1`,
    'https://cdn.infobip.com/files/1',
    'https://a.b.infobip.com/1',
    'https://mmg.whatsapp.net/v/t62/flow.json?ccb=1&oh=abc',
    'https://scontent.xx.fbcdn.net/v/flow.json',
  ]) {
    const { handler } = setup((call) => call.url === url ? { body: { ok: true } } : { body: { externalDownloadUrl: url } });
    assert.deepEqual(await json(await handler(req('GET', '/flow/1/json'))), { status: 200, body: { ok: true } }, url);
  }
});

test('allowedDownloadHosts replaces the default list', async () => {
  const url = 'https://flows-bucket.s3.eu-west-1.amazonaws.com/1.json';
  const custom = setup((call) => call.url === url ? { body: { ok: true } } : { body: { externalDownloadUrl: url } }, {
    allowedDownloadHosts: ['*.amazonaws.com'],
  });
  assert.equal((await custom.handler(req('GET', '/flow/1/json'))).status, 200);

  const baseOnly = setup(() => ({ body: { externalDownloadUrl: 'https://cdn.infobip.com/1' } }), {
    allowedDownloadHosts: ['acme.api.infobip.com'],
  });
  assert.equal((await baseOnly.handler(req('GET', '/flow/1/json'))).status, 502);
});

test('redirects during the download are checked against the allowlist too', async () => {
  const start = 'https://files.infobip.com/1';
  const bounced = setup((call) => call.url === start
    ? { status: 302, headers: { location: 'https://evil.example.com/steal' } }
    : { body: { externalDownloadUrl: start } });
  const res = await json(await bounced.handler(req('GET', '/flow/1/json')));
  assert.equal(res.status, 502);
  assert.equal(res.body.code, 'DOWNLOAD_HOST_NOT_ALLOWED');
  assert.equal(bounced.calls.length, 2);

  const ok = setup((call) => call.url === start
    ? { status: 302, headers: { location: '/2' } }
    : call.url === 'https://files.infobip.com/2' ? { body: { ok: 1 } } : { body: { externalDownloadUrl: start } });
  assert.deepEqual(await json(await ok.handler(req('GET', '/flow/1/json'))), { status: 200, body: { ok: 1 } });
});

// ── Multi-tenancy ──────────────────────────────────────────────────

test('getApiKey and getSender resolve per request', async () => {
  const tenants: Record<string, { key: string; sender: string }> = {
    a: { key: 'key-a', sender: '111' },
    b: { key: 'App key-b', sender: '+44 222/x' },
  };
  const { handler, calls } = setup(() => ({ body: { flows: [] } }), {
    apiKey: undefined,
    sender: undefined,
    getApiKey: async (request) => tenants[request.headers.get('x-tenant')!].key,
    getSender: (request) => tenants[request.headers.get('x-tenant')!].sender,
  });
  await handler(req('GET', '/flows', undefined, { 'x-tenant': 'a' }));
  await handler(req('GET', '/flows', undefined, { 'x-tenant': 'b' }));
  assert.equal(calls[0].headers.authorization, 'App key-a');
  assert.equal(calls[0].url, `${BASE}/whatsapp/1/senders/111/flows`);
  assert.equal(calls[1].headers.authorization, 'App key-b');
  // The sender is URL-encoded so it can't steer the path.
  assert.equal(calls[1].url, `${BASE}/whatsapp/1/senders/%2B44%20222%2Fx/flows`);
});

test('getApiKey is resolved once per request, even for save-flow\'s several calls', async () => {
  let resolved = 0;
  const { handler, calls } = setup((call) => call.method === 'POST' ? { body: { id: '1' } } : { body: {} }, {
    apiKey: undefined,
    getApiKey: () => { resolved += 1; return 'k'; },
  });
  await handler(req('POST', '/save-flow', { name: 'n', category: 'SURVEY', flow: { a: 1 } }));
  assert.equal(calls.length, 2);
  assert.equal(resolved, 1);
});

test('a failing or empty getApiKey/getSender is a 500 that hides the cause', async () => {
  const throwing = setup(() => ({ body: {} }), { apiKey: undefined, getApiKey: () => { throw new Error('vault: token=abc'); } });
  assert.deepEqual(await json(await throwing.handler(req('GET', '/flows'))), {
    status: 500, body: { error: 'Could not resolve the Infobip API key', code: 'CONFIGURATION_ERROR' },
  });
  const empty = setup(() => ({ body: {} }), { sender: undefined, getSender: () => '' });
  assert.deepEqual(await json(await empty.handler(req('GET', '/flows'))), {
    status: 500, body: { error: 'Infobip sender is not configured', code: 'CONFIGURATION_ERROR' },
  });
  assert.equal(throwing.calls.length + empty.calls.length, 0);
});

test('the context argument reaches authorize, getApiKey and getSender', async () => {
  const seen: unknown[] = [];
  const { handler } = setup(() => ({ body: {} }), {
    authorize: (_r, ctx) => { seen.push(ctx); return true; },
    getApiKey: (_r, ctx) => { seen.push(ctx); return 'k'; },
    getSender: (_r, ctx) => { seen.push(ctx); return 's'; },
  });
  const ctx = { tenant: 't1' };
  await handler(req('GET', '/flows'), ctx);
  assert.deepEqual(seen, [ctx, ctx, ctx]);
});

// ── Routing ────────────────────────────────────────────────────────

test('basePath scopes the routes, and unknown paths are a JSON 404', async () => {
  const { handler, calls } = setup(() => ({ body: { flows: [] } }), { basePath: '/api/flowbuilder/' });
  assert.equal((await handler(req('GET', '/api/flowbuilder/flows'))).status, 200);
  assert.equal((await handler(req('GET', '/api/flowbuilder/flows/?x=1'))).status, 200);
  assert.equal((await handler(req('GET', '/api/flowbuilder/FLOWS'))).status, 200);
  assert.deepEqual(await json(await handler(req('GET', '/flows'))), { status: 404, body: { error: 'Not found', code: 'NOT_FOUND' } });
  assert.equal((await handler(req('GET', '/api/flowbuilderx/flows'))).status, 404);
  assert.equal((await handler(req('POST', '/api/flowbuilder/flows'))).status, 404);
  assert.equal((await handler(req('GET', '/api/flowbuilder/settings/api-key'))).status, 404);
  assert.equal(calls.length, 3);
});

// ── Logging ────────────────────────────────────────────────────────

test('the logger gets method, path, status and duration, never bodies or keys', async () => {
  const { handler, logs } = setup(() => infobipError(400, 'Bad request'), { apiKey: 'super-secret-key' });
  await handler(req('POST', '/generate-flow?debug=1', { prompt: 'my secret prompt' }));
  assert.equal(logs.length, 1);
  const [entry] = logs;
  assert.equal(entry.method, 'POST');
  assert.equal(entry.path, '/generate-flow');
  assert.equal(entry.status, 400);
  assert.equal(entry.code, 'UPSTREAM_ERROR');
  assert.equal(typeof entry.durationMs, 'number');
  const line = JSON.stringify(logs);
  assert.ok(!line.includes('secret'), line);
});

test('the default logger prints one line without bodies or keys', async () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => { lines.push(args.join(' ')); };
  try {
    const { fetchImpl } = mockFetch(() => ({ body: { flows: [{ name: 'private flow' }] } }));
    const handler = createFlowBuilderHandler({
      baseUrl: BASE, apiKey: 'super-secret-key', sender: 's', authorize: () => true, fetch: fetchImpl,
    });
    await handler(req('GET', '/flows'));
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[flowbuilder\] GET \/flows 200 \d+ms$/);
});
