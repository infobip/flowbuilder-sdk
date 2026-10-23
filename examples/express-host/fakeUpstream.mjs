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

// A tiny in-memory stand-in for the Infobip WhatsApp Flow Management API, for
// running the examples (and `examples/verify.mjs`) without a live sender.
// Pass it as the `fetch` option of `createFlowBuilderRouter`.
//
// It covers what the UI uses: list, create, upload and download the flow JSON,
// preview, publish, patch, delete and AI generation (a fixed small flow).

export const FAKE_BASE_URL = 'https://fake-infobip.invalid';

export const GENERATED_FLOW = {
  version: '6.0',
  screens: [
    {
      id: 'WELCOME',
      title: 'Welcome',
      terminal: true,
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'TextHeading', text: 'Hello from the fake upstream' },
          { type: 'Footer', label: 'Done', 'on-click-action': { name: 'complete', payload: {} } },
        ],
      },
    },
  ],
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createFakeUpstream() {
  let nextId = 1000;
  const flows = new Map();
  const documents = new Map();
  const seed = (name, status) => {
    const id = String(nextId++);
    flows.set(id, { id, name, status, categories: ['OTHER'], updatedAt: new Date().toISOString() });
    documents.set(id, GENERATED_FLOW);
  };
  seed('Seeded onboarding flow', 'DRAFT');
  seed('Seeded survey flow', 'PUBLISHED');

  const touch = (flow) => ({ ...Object.assign(flow, { updatedAt: new Date().toISOString() }) });

  return async function fakeFetch(input, init = {}) {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : undefined;

    const download = /^\/download\/(\w+)$/.exec(url.pathname);
    if (download) return documents.has(download[1]) ? json(documents.get(download[1])) : json({}, 404);

    const match = /^\/whatsapp\/1\/senders\/[^/]+\/flows(?:\/(\w+))?(?:\/(json|preview|publish))?$/.exec(url.pathname);
    if (!match) return json({ requestError: { serviceException: { text: 'Not found' } } }, 404);
    const [, rawId, action] = match;
    const generating = rawId === 'generate' && !action;
    const id = generating ? undefined : rawId;
    const flow = id ? flows.get(id) : undefined;

    if (!id && !generating) {
      if (method === 'GET') return json({ flows: [...flows.values()] });
      if (method === 'POST') {
        const created = { id: String(nextId++), name: body.name, status: 'DRAFT', categories: body.categories ?? [] };
        flows.set(created.id, touch(created));
        return json(created);
      }
    }
    if (generating) return json({ generatedFlow: GENERATED_FLOW, responseId: 'fake-response' });
    if (id && !flow) return json({ requestError: { serviceException: { text: 'Flow not found' } } }, 404);

    if (!action && method === 'DELETE') {
      flows.delete(id);
      documents.delete(id);
      return json({});
    }
    if (!action && method === 'PATCH') return json(touch(Object.assign(flow, body)));
    if (action === 'json' && method === 'PUT') {
      documents.set(id, body);
      touch(flow);
      return json({ validationErrors: [] });
    }
    if (action === 'json' && method === 'GET') return json({ externalDownloadUrl: `${FAKE_BASE_URL}/download/${id}` });
    if (action === 'preview') return json({ previewUrl: `${FAKE_BASE_URL}/preview/${id}`, expiresAt: new Date(Date.now() + 3600e3).toISOString() });
    if (action === 'publish') {
      touch(Object.assign(flow, { status: 'PUBLISHED' }));
      return json({ id, status: 'PUBLISHED' });
    }
    return json({ requestError: { serviceException: { text: 'Not supported by the fake' } } }, 405);
  };
}
