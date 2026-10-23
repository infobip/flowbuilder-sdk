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

// A customer's Express app: its own (fake) cookie login, the Flow Builder
// backend mounted behind it, and the two front-end examples as static files.
//
//   npm run examples:prepare      # once: pack the library into the examples
//   node examples/express-host/server.mjs
//   open http://127.0.0.1:4100/       (log in, then /react/ or /html/)
//
// INFOBIP_BASE_URL / INFOBIP_API_KEY / INFOBIP_SENDER come from the
// environment or the nearest `.env` above this folder; values are never
// printed. FLOWBUILDER_FAKE_UPSTREAM=1 swaps Infobip for an in-memory fake.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createFlowBuilderRouter } from '@infobip/flowbuilder-sdk/server/express';
import { createFakeUpstream, FAKE_BASE_URL } from './fakeUpstream.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const examples = resolve(here, '..');
const pkg = join(here, 'node_modules/@infobip/flowbuilder-sdk');
if (!existsSync(pkg)) {
  console.error('Run `npm run examples:prepare` first.');
  process.exit(1);
}

// Load the first `.env` found walking up from here (the repo root).
for (let dir = here; ; dir = dirname(dir)) {
  if (existsSync(join(dir, '.env'))) {
    dotenv.config({ path: join(dir, '.env'), quiet: true });
    break;
  }
  if (dirname(dir) === dir) break;
}

const fake = process.env.FLOWBUILDER_FAKE_UPSTREAM === '1';
const { INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SENDER } = process.env;
if (!fake && !(INFOBIP_BASE_URL && INFOBIP_API_KEY && INFOBIP_SENDER)) {
  console.error('Set INFOBIP_BASE_URL, INFOBIP_API_KEY and INFOBIP_SENDER (or FLOWBUILDER_FAKE_UPSTREAM=1).');
  process.exit(1);
}

// ── Fake session: a demo user and an HMAC-signed cookie. Not real auth. ──
const SECRET = 'demo-only-secret';
const DEMO_USER = 'demo@acme.test';
const sign = (value) => createHmac('sha256', SECRET).update(value).digest('hex');

function sessionUser(req) {
  const cookie = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  if (!cookie) return null;
  const value = decodeURIComponent(cookie);
  const user = value.slice(0, value.lastIndexOf('.'));
  const signature = value.slice(value.lastIndexOf('.') + 1);
  const expected = Buffer.from(sign(user));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? user : null;
}

const app = express();

app.get('/login', (req, res) => {
  res.cookie('session', `${DEMO_USER}.${sign(DEMO_USER)}`, { httpOnly: true, sameSite: 'lax' });
  res.redirect(typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/');
});
app.get('/logout', (_req, res) => {
  res.clearCookie('session');
  res.redirect('/');
});

// The Flow Builder backend, behind the host's own auth.
app.use(
  '/flowbuilder/api',
  createFlowBuilderRouter({
    baseUrl: fake ? FAKE_BASE_URL : INFOBIP_BASE_URL,
    apiKey: fake ? 'fake-key' : INFOBIP_API_KEY,
    sender: fake ? 'fake-sender' : INFOBIP_SENDER,
    ...(fake ? { fetch: createFakeUpstream(), saveRetryDelays: [] } : null),
    authorize: (_request, { req }) =>
      sessionUser(req) ? true : Response.json({ error: 'Log in first', code: 'UNAUTHENTICATED' }, { status: 401 }),
  }),
);

// The two front-end examples, and the package's element bundle and fonts,
// served from this origin (the standalone script finds its fonts at ../fonts/).
app.use('/react', express.static(join(examples, 'react-esbuild-host/dist')));
app.get('/html/', (_req, res) => res.sendFile('index.html', { root: join(examples, 'html-host') }));
app.use('/vendor/flowbuilder', express.static(join(pkg, 'dist/element')));
app.use('/vendor/fonts', express.static(join(pkg, 'dist/fonts')));

app.get('/', (req, res) => {
  const user = sessionUser(req);
  res.type('html').send(`<!doctype html><title>Acme host</title>
<h1>Acme host app</h1>
<p>${user ? `Signed in as ${user}. <a href="/logout">Log out</a>` : '<a href="/login">Log in</a> (demo user)'}${fake ? ' - fake upstream' : ''}</p>
<ul><li><a href="/react/">React example</a></li><li><a href="/html/">HTML example</a></li></ul>`);
});

const port = Number(process.env.PORT ?? 4100);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`express-host listening on http://127.0.0.1:${server.address().port}`);
});
