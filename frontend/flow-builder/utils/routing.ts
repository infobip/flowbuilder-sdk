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

// ── Flow Builder router ────────────────────────────────────────────────────
//
// A tiny router with two interchangeable implementations behind one interface:
//   - `createHashRouter()` keeps the route in `location.hash`, so the standalone
//     app needs no router dependency or server catch-all routes.
//   - `createMemoryRouter()` keeps it in memory and never touches the host
//     page's URL — the default when the builder is embedded in someone else's
//     page.
// Each builder instance owns one router (see app/instanceContext.tsx); the
// `useRoute()`/`useNavigate()` hooks read it from context.
//
// Logical routes:
//   #/library              → Flow Library
//   #/settings             → Settings (appearance, chat history, API key)
//   #/flows/new            → Create flow (blank editor)
//   #/flows/:flowId        → Edit existing flow
//   #/flows/:flowId/preview → Read-only live preview (published flows)
// Editor mode is carried as a query param: `?mode=prompt` (default) | `?mode=json`.

export type EditorMode = 'prompt' | 'json';

export type Route =
  | { name: 'library' }
  | { name: 'settings' }
  | { name: 'flow-new'; mode: EditorMode }
  | { name: 'flow-edit'; flowId: string; mode: EditorMode }
  | { name: 'flow-preview'; flowId: string };

export const DEFAULT_ROUTE: Route = { name: 'library' };

function parseMode(value: string | null): EditorMode {
  return value === 'json' ? 'json' : 'prompt';
}

function decodeFlowId(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// Parse a raw hash (`#/flows/abc?mode=json`) into a typed Route.
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  const segments = path.split('/').filter(Boolean); // ['flows','abc']
  const mode = parseMode(new URLSearchParams(query).get('mode'));

  if (segments.length === 0 || segments[0] === 'library') {
    return { name: 'library' };
  }
  if (segments[0] === 'settings') {
    return { name: 'settings' };
  }
  if (segments[0] === 'flows') {
    const idOrNew = segments[1];
    if (!idOrNew || idOrNew === 'new') {
      return { name: 'flow-new', mode };
    }
    const flowId = decodeFlowId(idOrNew);
    if (flowId === null) return DEFAULT_ROUTE;
    if (segments[2] === 'preview') {
      return { name: 'flow-preview', flowId };
    }
    return { name: 'flow-edit', flowId, mode };
  }
  return DEFAULT_ROUTE;
}

// Build the hash string (including leading `#`) for a Route.
export function buildHash(route: Route): string {
  switch (route.name) {
    case 'library':
      return '#/library';
    case 'settings':
      return '#/settings';
    case 'flow-new': {
      const q = route.mode === 'json' ? '?mode=json' : '';
      return `#/flows/new${q}`;
    }
    case 'flow-edit': {
      const q = route.mode === 'json' ? '?mode=json' : '';
      return `#/flows/${encodeURIComponent(route.flowId)}${q}`;
    }
    case 'flow-preview':
      return `#/flows/${encodeURIComponent(route.flowId)}/preview`;
  }
}

export type NavigateOptions = {
  /** Replace the current history entry instead of pushing one (hash router). */
  replace?: boolean;
};

export type Router = {
  /** The current route. Returns the same object until the route changes. */
  current(): Route;
  navigate(route: Route, options?: NavigateOptions): void;
  /** Listen for route changes. Returns an unsubscribe function. */
  subscribe(listener: (route: Route) => void): () => void;
  /**
   * Attach to external route sources (the hash router's `hashchange`). Called
   * by the instance provider in an effect; returns the matching detach.
   */
  start?(): () => void;
};

export function routesEqual(a: Route, b: Route): boolean {
  return buildHash(a) === buildHash(b);
}

/** A router that keeps the route in memory only. Never reads or writes `window`. */
export function createMemoryRouter(initialRoute: Route = DEFAULT_ROUTE): Router {
  let route = initialRoute;
  const listeners = new Set<(route: Route) => void>();
  return {
    current: () => route,
    navigate(next) {
      if (routesEqual(route, next)) return;
      route = next;
      for (const listener of Array.from(listeners)) listener(route);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type HashWindow = Pick<Window, 'addEventListener' | 'removeEventListener'> & {
  location: Pick<Location, 'hash' | 'pathname' | 'search' | 'replace'>;
};

/**
 * A router backed by `location.hash` — the standalone app's behaviour. Nothing
 * touches the window until `navigate()` or `start()` is called, so creating
 * one during render is side-effect free.
 */
export function createHashRouter(win?: HashWindow): Router {
  const getWindow = (): HashWindow | null =>
    win ?? (typeof window === 'undefined' ? null : (window as unknown as HashWindow));
  const listeners = new Set<(route: Route) => void>();
  // Cache the parsed route per hash so `current()` is referentially stable
  // (required by useSyncExternalStore).
  let cachedHash: string | null = null;
  let cachedRoute: Route = DEFAULT_ROUTE;

  const current = (): Route => {
    const w = getWindow();
    const hash = w ? w.location.hash : '';
    if (hash !== cachedHash) {
      const route = parseHash(hash);
      cachedHash = hash;
      cachedRoute = route;
    }
    return cachedRoute;
  };

  // Last route listeners heard about, so the synchronous notify in navigate()
  // and the later `hashchange` for the same change notify only once.
  let notified: Route | null = null;
  const notify = () => {
    const route = current();
    if (notified && routesEqual(route, notified)) return;
    notified = route;
    for (const listener of Array.from(listeners)) listener(route);
  };

  return {
    current,
    navigate(route, options) {
      const w = getWindow();
      if (!w) return;
      const next = buildHash(route);
      if (w.location.hash === next) return;
      if (options?.replace) {
        w.location.replace(`${w.location.pathname}${w.location.search}${next}`);
      } else {
        w.location.hash = next;
      }
      // `hashchange` fires asynchronously; notifying now keeps the UI in step.
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      const w = getWindow();
      if (!w) return () => {};
      notified = current();
      // Normalize an empty/legacy hash to the library route on first mount.
      if (!w.location.hash) {
        w.location.replace(`${w.location.pathname}${w.location.search}${buildHash(DEFAULT_ROUTE)}`);
      }
      const onHashChange = () => notify();
      w.addEventListener('hashchange', onHashChange);
      // Catch the normalization above or a change made before start ran.
      notify();
      return () => w.removeEventListener('hashchange', onHashChange);
    },
  };
}
