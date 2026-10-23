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
import { buildHash, createHashRouter, createMemoryRouter, parseHash, routesEqual, type Route } from './routing.ts';

test('parseHash: empty / root hashes resolve to the library route', () => {
  assert.deepEqual(parseHash(''), { name: 'library' });
  assert.deepEqual(parseHash('#'), { name: 'library' });
  assert.deepEqual(parseHash('#/'), { name: 'library' });
  assert.deepEqual(parseHash('#/library'), { name: 'library' });
});

test('parseHash: unknown routes fall back to library', () => {
  assert.deepEqual(parseHash('#/nonsense'), { name: 'library' });
});

test('parseHash: settings route, ignoring any trailing segments or query', () => {
  assert.deepEqual(parseHash('#/settings'), { name: 'settings' });
  assert.deepEqual(parseHash('#/settings/'), { name: 'settings' });
  assert.deepEqual(parseHash('#/settings?mode=json'), { name: 'settings' });
});

test('parseHash: new-flow route with default and explicit modes', () => {
  assert.deepEqual(parseHash('#/flows/new'), { name: 'flow-new', mode: 'prompt' });
  assert.deepEqual(parseHash('#/flows/new?mode=json'), { name: 'flow-new', mode: 'json' });
  assert.deepEqual(parseHash('#/flows'), { name: 'flow-new', mode: 'prompt' });
});

test('parseHash: edit-flow route captures id and mode, decoding the id', () => {
  assert.deepEqual(parseHash('#/flows/abc123'), { name: 'flow-edit', flowId: 'abc123', mode: 'prompt' });
  assert.deepEqual(parseHash('#/flows/abc123?mode=json'), { name: 'flow-edit', flowId: 'abc123', mode: 'json' });
  assert.deepEqual(parseHash('#/flows/a%20b'), { name: 'flow-edit', flowId: 'a b', mode: 'prompt' });
});

test('parseHash: preview route captures flow id', () => {
  assert.deepEqual(parseHash('#/flows/abc123/preview'), { name: 'flow-preview', flowId: 'abc123' });
  assert.deepEqual(parseHash('#/flows/a%20b/preview'), { name: 'flow-preview', flowId: 'a b' });
});

test('parseHash: malformed encoded edit and preview ids fall back to library', () => {
  assert.deepEqual(parseHash('#/flows/%ZZ'), { name: 'library' });
  assert.deepEqual(parseHash('#/flows/%E0%A4%A/preview'), { name: 'library' });
});

test('parseHash: an invalid mode value falls back to prompt', () => {
  assert.deepEqual(parseHash('#/flows/x?mode=bogus'), { name: 'flow-edit', flowId: 'x', mode: 'prompt' });
});

test('buildHash: round-trips every route shape', () => {
  const routes: Route[] = [
    { name: 'library' },
    { name: 'settings' },
    { name: 'flow-new', mode: 'prompt' },
    { name: 'flow-new', mode: 'json' },
    { name: 'flow-edit', flowId: 'abc', mode: 'prompt' },
    { name: 'flow-edit', flowId: 'abc', mode: 'json' },
    { name: 'flow-preview', flowId: 'abc' },
  ];
  for (const route of routes) {
    assert.deepEqual(parseHash(buildHash(route)), route);
  }
});

test('buildHash: encodes flow ids that need escaping', () => {
  assert.equal(buildHash({ name: 'flow-edit', flowId: 'a b', mode: 'prompt' }), '#/flows/a%20b');
});

// ── Memory router ──────────────────────────────────────────────────────────

// A `window` that fails the test on any access, to prove the memory router
// never reads or writes the host page's URL.
function installTrapWindow(): () => void {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`memory router touched window.${String(prop)}`);
      },
      set(_target, prop) {
        throw new Error(`memory router wrote window.${String(prop)}`);
      },
    },
  );
  return () => {
    (globalThis as { window?: unknown }).window = original;
  };
}

test('memory router: starts at the library, or at the given initial route', () => {
  assert.deepEqual(createMemoryRouter().current(), { name: 'library' });
  const initial: Route = { name: 'flow-edit', flowId: 'abc', mode: 'json' };
  assert.deepEqual(createMemoryRouter(initial).current(), initial);
});

test('memory router: navigate updates the route and notifies subscribers', () => {
  const router = createMemoryRouter();
  const heard: Route[] = [];
  const unsubscribe = router.subscribe((route) => heard.push(route));

  router.navigate({ name: 'settings' });
  router.navigate({ name: 'flow-preview', flowId: 'x' });
  assert.deepEqual(router.current(), { name: 'flow-preview', flowId: 'x' });
  assert.deepEqual(heard, [{ name: 'settings' }, { name: 'flow-preview', flowId: 'x' }]);

  unsubscribe();
  router.navigate({ name: 'library' });
  assert.equal(heard.length, 2);
});

test('memory router: navigating to the current route is a no-op', () => {
  const router = createMemoryRouter({ name: 'settings' });
  const before = router.current();
  let calls = 0;
  router.subscribe(() => calls++);
  router.navigate({ name: 'settings' });
  assert.equal(calls, 0);
  assert.equal(router.current(), before);
});

test('memory router: never touches window or location', () => {
  const restore = installTrapWindow();
  try {
    const router = createMemoryRouter();
    const unsubscribe = router.subscribe(() => undefined);
    router.navigate({ name: 'flow-new', mode: 'json' });
    router.navigate({ name: 'library' });
    assert.equal(router.start, undefined);
    unsubscribe();
  } finally {
    restore();
  }
});

test('two memory routers are independent', () => {
  const a = createMemoryRouter();
  const b = createMemoryRouter();
  a.navigate({ name: 'settings' });
  assert.deepEqual(a.current(), { name: 'settings' });
  assert.deepEqual(b.current(), { name: 'library' });
});

// ── Hash router ────────────────────────────────────────────────────────────

function fakeHashWindow(initialHash = '') {
  const listeners = new Set<() => void>();
  const location = {
    hash: initialHash,
    pathname: '/app',
    search: '?x=1',
    replaced: [] as string[],
    replace(url: string) {
      this.replaced.push(url);
      this.hash = url.slice(url.indexOf('#'));
    },
  };
  return {
    location,
    listeners,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'hashchange') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'hashchange') listeners.delete(listener);
    },
    /** Simulate the user (or back/forward) changing the hash. */
    changeHash(hash: string) {
      location.hash = hash;
      for (const listener of Array.from(listeners)) listener();
    },
  };
}

test('hash router: reads the route from the hash', () => {
  const win = fakeHashWindow('#/flows/abc?mode=json');
  const router = createHashRouter(win as never);
  assert.deepEqual(router.current(), { name: 'flow-edit', flowId: 'abc', mode: 'json' });
});

test('hash router: malformed flow ids safely fall back on initial read and hashchange', () => {
  const win = fakeHashWindow('#/flows/%ZZ');
  const router = createHashRouter(win as never);
  const heard: Route[] = [];

  assert.deepEqual(router.current(), { name: 'library' });
  const stop = router.start!();
  const unsubscribe = router.subscribe((route) => heard.push(route));

  win.changeHash('#/flows/abc');
  assert.deepEqual(router.current(), { name: 'flow-edit', flowId: 'abc', mode: 'prompt' });
  win.changeHash('#/flows/%ZZ/preview');
  assert.deepEqual(router.current(), { name: 'library' });
  win.changeHash('#/flows/preview-id/preview');
  assert.deepEqual(router.current(), { name: 'flow-preview', flowId: 'preview-id' });
  assert.deepEqual(heard, [
    { name: 'flow-edit', flowId: 'abc', mode: 'prompt' },
    { name: 'library' },
    { name: 'flow-preview', flowId: 'preview-id' },
  ]);

  unsubscribe();
  stop();
});

test('hash router: creating one has no side effects; start normalizes an empty hash', () => {
  const win = fakeHashWindow('');
  const router = createHashRouter(win as never);
  assert.equal(win.listeners.size, 0);
  assert.deepEqual(win.location.replaced, []);

  const stop = router.start!();
  assert.deepEqual(win.location.replaced, ['/app?x=1#/library']);
  assert.equal(win.listeners.size, 1);
  stop();
  assert.equal(win.listeners.size, 0);
});

test('hash router: navigate writes the hash, notifying once even when hashchange follows', () => {
  const win = fakeHashWindow('#/library');
  const router = createHashRouter(win as never);
  const stop = router.start!();
  const heard: Route[] = [];
  router.subscribe((route) => heard.push(route));

  router.navigate({ name: 'flow-edit', flowId: 'abc', mode: 'json' });
  assert.equal(win.location.hash, '#/flows/abc?mode=json');
  // The browser's async hashchange for the same change must not re-notify.
  win.changeHash('#/flows/abc?mode=json');
  assert.deepEqual(heard, [{ name: 'flow-edit', flowId: 'abc', mode: 'json' }]);

  // Navigating to where we already are does nothing.
  router.navigate({ name: 'flow-edit', flowId: 'abc', mode: 'json' });
  assert.equal(heard.length, 1);
  stop();
});

test('hash router: navigate with replace uses location.replace', () => {
  const win = fakeHashWindow('#/library');
  const router = createHashRouter(win as never);
  router.navigate({ name: 'settings' }, { replace: true });
  assert.deepEqual(win.location.replaced, ['/app?x=1#/settings']);
  assert.deepEqual(router.current(), { name: 'settings' });
});

test('hash router: back/forward (hashchange) notifies subscribers', () => {
  const win = fakeHashWindow('#/library');
  const router = createHashRouter(win as never);
  const stop = router.start!();
  const heard: Route[] = [];
  router.subscribe((route) => heard.push(route));
  win.changeHash('#/settings');
  assert.deepEqual(heard, [{ name: 'settings' }]);
  stop();
  win.changeHash('#/library');
  assert.equal(heard.length, 1);
});

test('hash router: current() is referentially stable for an unchanged hash', () => {
  const win = fakeHashWindow('#/flows/abc');
  const router = createHashRouter(win as never);
  assert.equal(router.current(), router.current());
});

test('routesEqual compares by value', () => {
  assert.equal(routesEqual({ name: 'settings' }, { name: 'settings' }), true);
  assert.equal(
    routesEqual({ name: 'flow-edit', flowId: 'a', mode: 'prompt' }, { name: 'flow-edit', flowId: 'a', mode: 'json' }),
    false,
  );
});
