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
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FlowBuilder, FlowLibrary, createMemoryRouter, createMemoryStorageAdapter } from './index.ts';
import { ErrorBoundary, ErrorPanel } from '../app/ErrorBoundary.tsx';
import { FlowBuilderProvider } from './index.ts';
import { FlowBuilderRoot } from '../app/FlowBuilderRoot.tsx';

const h = React.createElement;

// No DOM in node: rendering must not reach for `window`, `document` or `location`.
function assertNoDom(): void {
  assert.equal(typeof (globalThis as { window?: unknown }).window, 'undefined');
  assert.equal(typeof (globalThis as { document?: unknown }).document, 'undefined');
  assert.equal(typeof (globalThis as { location?: unknown }).location, 'undefined');
}

test('FlowBuilder renders its themed root on the server with a memory router and storage', () => {
  assertNoDom();
  const html = renderToString(
    h(FlowBuilder, { routing: createMemoryRouter(), storage: createMemoryStorageAdapter(), apiBaseUrl: '/api' }),
  );
  assert.match(html, /data-flowbuilder-root/);
  // Public default layout is "fill".
  assert.match(html, /data-layout="fill"/);
  assertNoDom();
});

test('FlowBuilder defaults to memory routing and fill layout', () => {
  const html = renderToString(h(FlowBuilder, { storage: createMemoryStorageAdapter() }));
  assert.match(html, /data-flowbuilder-root/);
  assert.match(html, /data-layout="fill"/);
});

test('layout "page" can still be requested explicitly', () => {
  const html = renderToString(h(FlowBuilder, { layout: 'page', routing: 'memory', storage: createMemoryStorageAdapter() }));
  assert.match(html, /data-layout="page"/);
});

test('FlowLibrary renders inside a provider with its own themed root', () => {
  const html = renderToString(
    h(FlowBuilderProvider, { storage: createMemoryStorageAdapter() }, h(FlowLibrary, { onOpenFlow: () => {} })),
  );
  assert.match(html, /data-flowbuilder-root/);
});

test('ErrorBoundary derives the failed state from a thrown error', () => {
  const state = ErrorBoundary.getDerivedStateFromError(new Error('kaboom'));
  assert.equal(state.failed, true);
  assert.equal((state.error as Error).message, 'kaboom');
});

test('ErrorBoundary renders children while healthy', () => {
  const html = renderToString(h(ErrorBoundary, null, h('p', null, 'fine')));
  assert.match(html, /fine/);
});

test('ErrorPanel shows the message and a Try again button inside the builder root', () => {
  const html = renderToString(
    h(
      FlowBuilderProvider,
      { storage: createMemoryStorageAdapter() },
      h(FlowBuilderRoot, null, h(ErrorPanel, { error: new Error('kaboom'), onRetry: () => {} })),
    ),
  );
  assert.match(html, /data-flowbuilder-root/);
  assert.match(html, /kaboom/);
  assert.match(html, /Try again/);
});

test('ErrorBoundary instance reports render errors and resets', () => {
  // renderToString does not run componentDidCatch or recover from errors, so
  // the lifecycle is exercised directly on an instance.
  const reported: Array<{ error: unknown; source: string }> = [];
  const boundary = new ErrorBoundary({ onError: (error, info) => reported.push({ error, source: info.source }) });
  let state = boundary.state;
  boundary.setState = ((next: typeof state) => {
    state = next;
  }) as typeof boundary.setState;
  const error = new Error('kaboom');
  boundary.componentDidCatch(error);
  assert.deepEqual(reported, [{ error, source: 'render' }]);
  boundary.reset();
  assert.equal(state.failed, false);
});
