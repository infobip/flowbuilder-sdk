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

// Host-page verification for the embedding examples (Milestone 6).
//
//   npm run examples:prepare && npm run examples:verify
//
// Starts examples/express-host on a free localhost port, drives react-esbuild-host
// and html-host with Chromium (playwright-core) and prints a PASS/FAIL table.
//
// Two runs of express-host:
//   - read-only checks against the real upstream when the repo `.env` has
//     INFOBIP_* (list, open, preview; nothing is created, saved or deleted),
//     otherwise against the in-memory fake;
//   - write checks (create, save, publish, delete) against the fake upstream.
//
// Needs playwright-core and a Chromium. playwright-core is imported by package
// name; set PLAYWRIGHT_CORE to the path of its index.mjs to use another copy.
// CHROMIUM_PATH is optional: when unset, Playwright uses its own browser
// (install it once with `npx playwright install chromium`).

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PLAYWRIGHT_CORE = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(PLAYWRIGHT_CORE ? pathToFileURL(PLAYWRIGHT_CORE).href : 'playwright-core');
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || undefined;

const TARGETS = ['react-esbuild-host', 'html-host'];
const results = []; // { check, target, ok, note }
// `known` marks a documented, not-yet-fixed library gap: shown as KNOWN, never fails the run.
const record = (check, target, ok, note = '', known = false) => results.push({ check, target, ok, note, known });
const shot = (page, name) => page.screenshot({ path: `/tmp/fb-examples-${name}.png` });

// ── The server under test ───────────────────────────────────────────────────

const freePort = () =>
  new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const children = new Set();
process.on('exit', () => children.forEach((child) => child.kill('SIGKILL')));

async function startHost({ fake }) {
  const port = await freePort();
  const env = { ...process.env, PORT: String(port) };
  if (fake) env.FLOWBUILDER_FAKE_UPSTREAM = '1';
  else delete env.FLOWBUILDER_FAKE_UPSTREAM;
  const child = spawn(process.execPath, [join(here, 'express-host/server.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  const ready = await new Promise((resolve) => {
    child.stdout.on('data', (chunk) => String(chunk).includes('listening') && resolve(true));
    child.on('exit', () => resolve(false));
  });
  if (!ready) return null;
  return { base: `http://127.0.0.1:${port}`, stop: () => { child.kill('SIGTERM'); children.delete(child); } };
}

// ── Browser helpers ─────────────────────────────────────────────────────────

// Counts, per target and event type, the listeners added and not removed again
// on window, document and every MediaQueryList.
const LISTENER_PROBE = () => {
  const live = new Map(); // key -> Set of listener ids
  const ids = new WeakMap();
  let next = 0;
  const idOf = (fn) => (ids.has(fn) ? ids.get(fn) : (ids.set(fn, ++next), next));
  const nameOf = (t) => (t === window ? 'window' : t === document ? 'document' : t instanceof MediaQueryList ? 'mql:' + t.media : null);
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const name = nameOf(this);
    if (name && fn) {
      const key = `${name}:${type}`;
      if (!live.has(key)) live.set(key, new Set());
      live.get(key).add(`${idOf(fn)}:${typeof opts === 'object' ? !!opts?.capture : !!opts}`);
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    const name = nameOf(this);
    if (name && fn) live.get(`${name}:${type}`)?.delete(`${idOf(fn)}:${typeof opts === 'object' ? !!opts?.capture : !!opts}`);
    return remove.call(this, type, fn, opts);
  };
  window.__listeners = () => Object.fromEntries([...live].filter(([, set]) => set.size).map(([key, set]) => [key, set.size]));
};

// Every computed property of the first match, minus the layout-dependent ones.
const computedStyleOf = (selector) => {
  const cs = getComputedStyle(document.querySelector(selector));
  const out = {};
  for (const prop of cs) if (!/^(width|height|inline-size|block-size|min-|max-|perspective-origin|transform-origin)/.test(prop)) out[prop] = cs.getPropertyValue(prop);
  return out;
};

const diff = (a, b) => Object.keys({ ...a, ...b }).filter((key) => a[key] !== b[key]);

// Elements under `host` (a document or shadow root) painted in `rgb`.
const countColour = ([rgb, id]) => {
  const host = id ? document.getElementById(id).shadowRoot : document;
  let count = 0;
  for (const el of host.querySelectorAll('[data-flowbuilder-root], [data-flowbuilder-root] *')) {
    const cs = getComputedStyle(el);
    if ([cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor].includes(rgb)) count++;
  }
  return count;
};

async function newSession(browser, base, { login }) {
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(LISTENER_PROBE);
  const page = await context.newPage();
  const log = { errors: [], badResponses: [], fonts: 0, console: [] };
  page.on('console', (msg) => {
    log.console.push(msg.text());
    // A 429 is the live Infobip sender throttling the read-only checks, not a builder error.
    if (msg.type() === 'error' && !/status of 429/.test(msg.text())) log.errors.push(msg.text());
  });
  page.on('pageerror', (err) => log.errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) log.badResponses.push(`${res.status()} ${new URL(res.url()).pathname}`);
    if (res.url().endsWith('.woff2') && res.ok() && res.url().startsWith(base)) log.fonts++;
  });
  if (login) await page.goto(`${base}/login`);
  return { context, page, log };
}

const urlOf = (base, target, hash = '') => `${base}${target === 'html-host' ? '/html/' : '/react/'}${hash}`;
// The element that holds the builder UI: the root div (React) or an element's shadow tree (HTML).
const rootOf = (page, target, id = 'c') => (target === 'html-host' ? page.locator(`#${id}`) : page.locator('[data-flowbuilder-root]').first());
// Visible text of a builder, also for an element whose UI lives in a shadow root.
const textOf = (page, target, id = 'c') =>
  page.evaluate(([isHtml, id]) => (isHtml ? document.getElementById(id).shadowRoot : document.querySelector('[data-flowbuilder-root]')).textContent, [target === 'html-host', id]);
const LIBRARY_READY = /Showing \d+/;

// ── Checks ──────────────────────────────────────────────────────────────────

async function checkUnauthenticated(browser, base, target) {
  const { context, page, log } = await newSession(browser, base, { login: false });
  await page.goto(urlOf(base, target, '#/flows'));
  const root = rootOf(page, target, 'a');
  const shown = await root.getByText(/Unable to load|Log in first|nicht geladen/i).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  const got401 = log.badResponses.some((entry) => entry.startsWith('401 /flowbuilder/api/'));
  const otherErrors = log.errors.filter((text) => !/401/.test(text));
  record('unauthenticated: error shown, API answered 401', target, shown && got401 && !otherErrors.length, `error UI=${shown} 401=${got401}${otherErrors.length ? ` other: ${otherErrors[0]}` : ''}`);
  await shot(page, `${target}-unauthenticated`);
  await context.close();
}

async function checkStyleIsolation(browser, base, target) {
  const selectors = target === 'html-host' ? ['h1', 'button', 'ul'] : ['header h1', 'footer button', 'nav ul'];
  // Baseline: the html host with the element script blocked; the React host's
  // `#/` route, which never mounts the builder (its stylesheet is on the page either way).
  const blocked = await newSession(browser, base, { login: true });
  if (target === 'html-host') await blocked.page.route('**/standalone.js', (route) => route.abort());
  await blocked.page.goto(urlOf(base, target, '#/'));
  await blocked.page.waitForSelector(selectors[0]);
  const baseline = await Promise.all(selectors.map((sel) => blocked.page.evaluate(computedStyleOf, sel)));
  await blocked.context.close();

  const { context, page, log } = await newSession(browser, base, { login: true });
  await page.goto(urlOf(base, target, target === 'html-host' ? '' : '#/full'));
  await rootOf(page, target).getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  const mounted = await Promise.all(selectors.map((sel) => page.evaluate(computedStyleOf, sel)));
  const changed = selectors.flatMap((sel, i) => diff(baseline[i], mounted[i]).map((prop) => `${sel}:${prop}`));
  record("host's h1, button, ul styles identical with and without the builder", target, !changed.length, changed.slice(0, 4).join(', '));

  const fonts = await page.evaluate(async () => (await document.fonts.ready, [...document.fonts].filter((f) => f.status === 'loaded').length));
  const fontsOk = log.fonts > 0 && !log.badResponses.some((entry) => /woff2/.test(entry));
  record('fonts load from the host origin', target, fontsOk, `woff2 served=${log.fonts}, loaded faces=${fonts}`);
  await shot(page, `${target}-builder`);
  await context.close();
}

// Counts pure-red pixels (the host's underline colour) in an element's screenshot.
async function redPixels(page, selector) {
  const png = await page.locator(selector).first().screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let red = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 230 && data[i + 1] < 40 && data[i + 2] < 40) red += 1;
    return red;
  }, png.toString('base64'));
}

// The host's `* { letter-spacing; font-style; text-transform; color; font-family; ... }` rule (and its
// inherited values) must not reach the builder's own elements. Checked against the builder's own values.
async function checkTextIsolation(browser, base, target) {
  const { context, page } = await newSession(browser, base, { login: true });
  await page.goto(urlOf(base, target, target === 'html-host' ? '' : '#/full'));
  await rootOf(page, target).getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  const leaks = await page.evaluate((id) => {
    const host = id ? document.getElementById(id).shadowRoot : document;
    const root = host.querySelector('[data-flowbuilder-root]');
    const hostRule = { 'letter-spacing': /^(?!(2|3)px$)/, 'word-spacing': /^(normal|0px)$/, 'font-style': /^normal$/, 'text-transform': /^none$/, 'text-shadow': /^none$/, 'text-indent': /^0px$/, 'white-space': /^(normal|nowrap|pre)$/, cursor: /^(auto|pointer|default|text|not-allowed)$/, 'font-variant-caps': /^normal$/, 'font-family': /Plex|ui-monospace|monospace/, 'line-height': /^(?!66px$)/ };
    // The first match of a few distinct kinds of element: nav label, page title, button, card name, and a plain span.
    const picks = [root.querySelector('nav button span'), root.querySelector('h1, h2'), root.querySelector('button'), root.querySelector('[role=tabpanel] span, main span, span'), root];
    const out = [];
    for (const el of picks.filter(Boolean)) {
      const cs = getComputedStyle(el);
      for (const [prop, ok] of Object.entries(hostRule)) if (!ok.test(cs.getPropertyValue(prop))) out.push(`${el.tagName.toLowerCase()}:${prop}=${cs.getPropertyValue(prop)}`);
      if (/hotpink|255, 105, 180/.test(cs.color)) out.push(`${el.tagName.toLowerCase()}:color=hotpink`);
      if (cs.fontSize === '22px' && el === root) out.push('root:font-size=22px');
      if (cs.textDecorationLine !== 'none') out.push(`${el.tagName.toLowerCase()}:text-decoration=${cs.textDecorationLine}`);
    }
    return out;
  }, target === 'html-host' ? 'c' : null);
  // A host's text-decoration isn't inherited, it's drawn through descendants, so
  // computed styles can't see it: look for the host's red underline in pixels.
  const decoration = await redPixels(page, target === 'html-host' ? 'infobip-flow-builder#c' : '[data-flowbuilder-root]');
  if (decoration > 0) leaks.push(`host text-decoration drawn through the builder (${decoration} red px)`);
  record("host's universal and inherited text styles don't reach the builder", target, !leaks.length, leaks.slice(0, 4).join(', '));
  await context.close();
}

async function checkHashTitleAccentGermanModal(browser, base, target) {
  const { context, page, log } = await newSession(browser, base, { login: true });
  await page.goto(urlOf(base, target, target === 'html-host' ? '' : '#/full'));
  const library = rootOf(page, target);
  await library.getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });

  // location.hash, document.title and history are untouched by in-builder navigation.
  const before = await page.evaluate(() => ({ hash: location.hash, title: document.title, length: history.length, overflow: document.body.style.overflow }));
  await library.getByRole('button', { name: /^(Flow erstellen|Create flow)$/ }).first().click();
  await library.getByPlaceholder(/Describe the flow you want/).waitFor({ timeout: 10000 });
  await library.getByRole('button', { name: /^(Flow-Bibliothek|Flow library)$/ }).first().click();
  await library.getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  const after = await page.evaluate(() => ({ hash: location.hash, title: document.title, length: history.length, overflow: document.body.style.overflow }));
  record('location.hash, document.title, history and body scroll untouched', target, JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));

  // The custom accent token paints something; an unthemed builder never does.
  const accent = 'rgb(91, 60, 196)';
  const themedCount = await page.evaluate(countColour, [accent, target === 'html-host' ? 'a' : null]);
  const plainCount = target === 'html-host' ? await page.evaluate(countColour, [accent, 'b']) : 0;
  record('custom accent token changes the accent colour', target, themedCount > 0 && plainCount === 0, `themed elements=${themedCount}, unthemed=${plainCount}`);

  // German where the host gave messages, English elsewhere.
  const text = await textOf(page, target);
  const german = /Flow-Bibliothek/.test(text) && /Neuer Flow/.test(text);
  const fallback = /Create a new flow/.test(text);
  record('German messages show, English fallback elsewhere', target, german && fallback, `de nav=${german}, en fallback=${fallback}`);

  // A modal renders inside the builder's root and is closed again.
  // (Drafts only: published flows have no delete button. The dialog is cancelled, never confirmed.)
  await library.getByRole('tab', { name: /^Drafts/ }).click();
  const deleteButton = library.getByRole('button', { name: /^(Löschen|Delete)\b/ }).first();
  await deleteButton.click();
  await page.waitForSelector(target === 'html-host' ? '#c >> [role=dialog]' : '[role=dialog]', { timeout: 5000 });
  const placement = await page.evaluate((id) => {
    const host = id ? document.getElementById(id).shadowRoot : document;
    const dialog = host.querySelector('[role=dialog]');
    return {
      insideRoot: !!dialog.closest('[data-flowbuilder-root]'),
      rootNode: dialog.getRootNode() instanceof ShadowRoot ? 'shadow root' : 'document',
      leakedToLightDom: id ? !!document.querySelector('[role=dialog]') : false,
      directBodyChild: dialog.parentElement === document.body,
    };
  }, target === 'html-host' ? 'c' : null);
  await shot(page, `${target}-modal`);
  await library.getByRole('button', { name: /^(Abbrechen|Cancel)$/ }).first().click();
  const closed = await library.locator('[role=dialog]').count() === 0;
  const modalOk = placement.insideRoot && !placement.leakedToLightDom && !placement.directBodyChild && closed;
  record('modal opens inside the root / shadow root and cancels', target, modalOk, `${JSON.stringify(placement)} closed=${closed}`);

  record('no console errors', target, log.errors.length === 0, log.errors[0] ?? '');
  await context.close();
}

async function checkReactUnmount(browser, base) {
  const { context, page, log } = await newSession(browser, base, { login: true });
  const snapshot = () => page.evaluate(() => ({
    head: document.head.querySelectorAll('style, link[rel=stylesheet]').length,
    leftover: [...document.head.querySelectorAll('style')].map((el) => el.id || 'style'),
    adopted: document.adoptedStyleSheets.length,
    listeners: window.__listeners(),
  }));
  await page.goto(urlOf(base, 'react-esbuild-host', '#/'));
  await page.waitForSelector('header h1');
  const s0 = await snapshot();
  await page.evaluate(() => (location.hash = '#/full'));
  await rootOf(page, 'react-esbuild-host').getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  const s1 = await snapshot();
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForFunction(() => !document.querySelector('[data-flowbuilder-root]'));
  const s2 = await snapshot();
  const rest = (snap) => ({ adopted: snap.adopted, listeners: snap.listeners });
  const clean = JSON.stringify(rest(s0)) === JSON.stringify(rest(s2)) && s0.adopted === s1.adopted;
  record('unmount leaves no listeners or adoptedStyleSheets behind', 'react-esbuild-host', clean, clean ? 'listener counts back to the baseline' : `before=${JSON.stringify(rest(s0))} after=${JSON.stringify(rest(s2))}`);
  // The builder adds no <style> of its own (the phone preview's CSS ships in the stylesheet).
  record('unmount leaves no <style> tag in document.head', 'react-esbuild-host', s2.head === s0.head, `head style/link nodes: ${s0.head} -> ${s1.head} mounted -> ${s2.head} after; ${s2.leftover.join(', ') || 'none left'}`);
  await context.close();
  return log;
}

async function checkHtmlInstances(browser, base) {
  const { context, page } = await newSession(browser, base, { login: true });
  await page.goto(urlOf(base, 'html-host'));
  const a = rootOf(page, 'html-host', 'a');
  const b = rootOf(page, 'html-host', 'b');
  await a.getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  await b.getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  await shot(page, 'html-host-three-instances');

  // Navigating a leaves b alone; their stored preferences use separate keys.
  const keysBefore = await page.evaluate(() => Object.keys(localStorage));
  await a.getByRole('button', { name: 'Create flow', exact: true }).first().click();
  await a.getByPlaceholder(/Describe the flow you want/).waitFor({ timeout: 10000 });
  await b.locator('button', { hasText: /^Table$/ }).first().click();
  await page.waitForTimeout(300);
  const aText = await textOf(page, 'html-host', 'a');
  const bText = await textOf(page, 'html-host', 'b');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const added = keys.filter((key) => !keysBefore.includes(key));
  const separate = added.every((key) => key.includes('demo-b'));
  const isolated = /What do you want to build/.test(aText) && !/What do you want to build/.test(bText) && /Flow library/.test(bText) && separate;
  record('two instances do not share state (route, storage keys)', 'html-host', isolated, `new keys: ${added.join(', ') || 'none'}`);

  // Removing an element tears its builder down; added elements add nothing page-wide.
  const probe = () => page.evaluate(() => ({ adopted: document.adoptedStyleSheets.length, head: document.head.children.length, listeners: window.__listeners() }));
  const s0 = await probe();
  await page.evaluate(() => {
    const el = document.createElement('infobip-flow-builder');
    el.id = 'extra';
    el.setAttribute('api-base-url', '/flowbuilder/api');
    el.setAttribute('storage-key', 'demo-extra');
    el.style.cssText = 'display:block;height:300px';
    document.body.append(el);
  });
  await page.locator('#extra').getByText(LIBRARY_READY).first().waitFor({ timeout: 30000 });
  await page.evaluate(() => document.getElementById('extra').remove());
  await page.waitForTimeout(300);
  const s1 = await probe();
  record('unmount leaves no listeners, <style> or adoptedStyleSheets behind', 'html-host', JSON.stringify(s0) === JSON.stringify(s1), JSON.stringify(s0) === JSON.stringify(s1) ? '' : `before=${JSON.stringify(s0)} after=${JSON.stringify(s1)}`);
  await context.close();
}

// The pasted flow differs from the generated one, so the save has something to carry.
const PASTED_FLOW = {
  version: '6.0',
  screens: [{ id: 'PASTED', title: 'Pasted', terminal: true, layout: { type: 'SingleColumnLayout', children: [{ type: 'TextHeading', text: 'Pasted in the JSON editor' }, { type: 'Footer', label: 'Done', 'on-click-action': { name: 'complete', payload: {} } }] } }],
};

async function checkWritePath(browser, base, target) {
  const { context, page, log } = await newSession(browser, base, { login: true });
  await page.goto(urlOf(base, target, target === 'html-host' ? '' : '#/full'));
  const root = rootOf(page, target);
  await root.getByText(LIBRARY_READY).first().waitFor({ timeout: 15000 });

  const flowsOnServer = async () => (await (await context.request.get(`${base}/flowbuilder/api/flows`)).json()).flows;
  const seen = (pattern) => log.console.some((line) => pattern.test(line));
  const steps = [];
  const step = (name, ok) => { steps.push(`${ok ? '' : '!'}${name}`); return ok; };
  const settle = () => page.waitForTimeout(600);

  // Create: generate (mocked upstream), then edit in the JSON mode.
  await root.getByRole('button', { name: /^(Flow erstellen|Create flow)$/ }).first().click();
  await root.getByPlaceholder(/Describe the flow you want/).fill('A tiny greeting flow');
  await root.getByRole('button', { name: 'Generate', exact: true }).click();
  await root.getByText(/^(JSON-Editor|JSON editor)$/).first().waitFor({ timeout: 15000 }).catch(async (e) => { await shot(page, `${target}-write-stuck`); throw e; });
  await root.getByText(/^(JSON-Editor|JSON editor)$/).first().click();
  const editor = root.getByRole('textbox', { name: 'Flow JSON' });
  await page.waitForFunction((id) => !(id ? document.getElementById(id).shadowRoot : document).querySelector('textarea[aria-label="Flow JSON"]')?.disabled, target === 'html-host' ? 'c' : null);
  await editor.fill(JSON.stringify(PASTED_FLOW, null, 2));
  await root.getByRole('button', { name: /Save changes/ }).click();
  await root.getByRole('button', { name: /^(Entwurf speichern|Save draft)$/ }).click();
  await root.getByText(/^SAVED$/i).first().waitFor({ timeout: 10000 });
  await settle();
  const created = (await flowsOnServer()).find((flow) => /tiny greeting/.test(flow.name));
  const savedJson = created ? await (await context.request.get(`${base}/flowbuilder/api/flow/${created.id}/json`)).json() : null;
  step('created on the server', !!created);
  step('pasted JSON was uploaded', savedJson?.screens?.[0]?.id === 'PASTED');
  step('created event', seen(target === 'html-host' ? /^c flowbuilder:created / : /\[host\] created /));
  await shot(page, `${target}-write-editor`);

  // Save again: a second save is an update, not a second flow.
  await editor.fill(JSON.stringify(PASTED_FLOW, null, 2).replace('Pasted in the JSON editor', 'Edited once more'));
  await root.getByRole('button', { name: /Save changes/ }).click();
  await root.getByRole('button', { name: /^(Entwurf speichern|Save draft)$/ }).click();
  await settle();
  step('saved event', seen(target === 'html-host' ? /^c flowbuilder:saved / : /\[host\] saved /));
  step('no duplicate flow', (await flowsOnServer()).filter((flow) => /tiny greeting/.test(flow.name)).length === 1);

  // Publish through the confirm dialog.
  await page.waitForTimeout(1500);
  await shot(page, `${target}-write-before-publish`);
  await root.getByRole('button', { name: /^(Veröffentlichen|Publish)$/ }).last().click();
  await root.getByRole('dialog').getByRole('button', { name: /^Publish flow$/ }).click();
  await settle();
  step('published on the server', (await flowsOnServer()).find((flow) => flow.id === created?.id)?.status === 'PUBLISHED');
  step('published event', seen(target === 'html-host' ? /^c flowbuilder:published / : /\[host\] published /));

  // Delete a draft from the library (published flows cannot be deleted).
  await root.getByRole('button', { name: /^(Flow library|Flow-Bibliothek)$/ }).first().click();
  await root.getByText(LIBRARY_READY).first().waitFor({ timeout: 15000 });
  await root.getByRole('tab', { name: /Drafts|Entwürfe/ }).click();
  await root.getByRole('button', { name: /(delete|löschen).*Seeded onboarding flow|Seeded onboarding flow.*(delete|löschen)/i }).first().click();
  await shot(page, `${target}-write-delete-dialog`);
  await root.getByRole('dialog').getByRole('button', { name: /^(Delete|Löschen)$/ }).click();
  await settle();
  step('deleted on the server', !(await flowsOnServer()).some((flow) => flow.id === '1000'));
  step('deleted event', seen(target === 'html-host' ? /^c flowbuilder:deleted / : /\[host\] deleted /));
  await shot(page, `${target}-write-after-delete`);

  const failed = steps.filter((name) => name.startsWith('!'));
  record('create (JSON mode), save, publish, delete via the UI with events', target, failed.length === 0, failed.length ? failed.join(', ') : steps.length + ' steps');
  record('no console errors (write path)', target, log.errors.length === 0, log.errors[0] ?? '');
  await context.close();
}

// ── Run ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {});
let live = await startHost({ fake: false });
let upstream = 'live Infobip sender (read-only)';
if (!live) {
  console.log('No INFOBIP_* credentials found; running the read-only checks against the fake upstream.');
  live = await startHost({ fake: true });
  upstream = 'fake upstream';
}
console.log(`read-only checks: ${upstream}; write checks: fake upstream (fresh instance per target)\n`);

try {
  for (const target of TARGETS) {
    await checkUnauthenticated(browser, live.base, target);
    await checkStyleIsolation(browser, live.base, target);
    await checkTextIsolation(browser, live.base, target);
    await checkHashTitleAccentGermanModal(browser, live.base, target);
  }
  await checkReactUnmount(browser, live.base);
  await checkHtmlInstances(browser, live.base);
  for (const target of TARGETS) {
    const fake = await startHost({ fake: true });
    try { await checkWritePath(browser, fake.base, target); } finally { fake.stop(); }
  }
} catch (error) {
  record('verification run completed', '-', false, String(error?.message ?? error).split('\n')[0]);
  console.error(error);
} finally {
  await browser.close();
  live.stop();
}

const rows = results.map(({ check, target, ok, note, known }) => [ok ? 'PASS' : known ? 'KNOWN' : 'FAIL', target, check, note]);
const width = (i) => Math.max(...rows.map((row) => row[i].length));
for (const row of rows) console.log(`${row[0].padEnd(5)}  ${row[1].padEnd(width(1))}  ${row[2].padEnd(width(2))}  ${row[3]}`);
const failed = results.filter((r) => !r.ok && !r.known).length;
const known = results.filter((r) => !r.ok && r.known).length;
console.log(`\n${results.length - failed - known} passed, ${failed} failed, ${known} known issue(s). Screenshots: /tmp/fb-examples-*.png`);
process.exit(failed ? 1 : 0);
