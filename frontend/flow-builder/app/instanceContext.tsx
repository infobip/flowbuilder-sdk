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

// ── Flow Builder instance context ──────────────────────────────────────────
//
// Everything that used to be global — the route, persisted preferences, the
// flow JSON cache, the flow sync bus, the dialog portal target, the document
// title — belongs to one builder instance instead. The provider creates them
// once per mount, so two builders on one page (or a builder inside a host's
// own app) never share state or reach outside their root element.
//
// The standalone host (frontend/main.tsx) opts back into the page-owning
// behaviour: hash routing, layout "page" and a title callback that writes
// `document.title`.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createFlowSyncBus, type FlowSyncBus } from '../../shared';
import { createFlowJsonCache, type FlowJsonCache } from '../services/flowJsonCache';
import {
  createInstanceStorage,
  createLocalStorageAdapter,
  DEFAULT_STORAGE_KEY,
  type InstanceStorage,
  type StorageAdapter,
} from '../services/storage';
import {
  createHashRouter,
  createMemoryRouter,
  DEFAULT_ROUTE,
  type NavigateOptions,
  type Route,
  type Router,
} from '../utils/routing';

/**
 * `page`: the builder owns the browser window (today's standalone app) — it
 * grows with its content, the window scrolls, and dialogs lock body scroll.
 * `fill`: the builder fills the host's container, which sizes it; it scrolls
 * internally and never touches the host page's scrolling.
 */
export type FlowBuilderLayout = 'page' | 'fill';

export type FlowBuilderRouting = 'hash' | 'memory' | Router;

export type FlowBuilderInstanceOptions = {
  /** Defaults to `'hash'`. Read once on mount. */
  routing?: FlowBuilderRouting;
  /** The memory router's first route. Defaults to the library. */
  initialRoute?: Route;
  /** Called after every route change, including the initial normalization. */
  onNavigate?: (route: Route) => void;
  /** Defaults to localStorage. Read once on mount. */
  storage?: StorageAdapter;
  /** Namespace prefixed to every stored key. Defaults to `'flowbuilder'`. */
  storageKey?: string;
  /** Defaults to `'page'`. */
  layout?: FlowBuilderLayout;
  /**
   * The page's title, or `null` when the current page has none of its own
   * (the host should restore its default). Nothing writes `document.title`
   * unless the host does it here.
   */
  onTitleChange?: (title: string | null) => void;
  /** True while the editor holds unsaved changes, so the host can guard its navigation. */
  onDirtyChange?: (dirty: boolean) => void;
};

type InstanceCallbacks = Pick<FlowBuilderInstanceOptions, 'onNavigate' | 'onTitleChange' | 'onDirtyChange'>;

export type InstanceContextValue = {
  /** Attached to the `data-flowbuilder-root` element by FlowBuilderApp. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  getRoot(): HTMLElement | null;
  router: Router;
  storage: InstanceStorage;
  flowJsonCache: FlowJsonCache;
  syncBus: FlowSyncBus;
  layout: FlowBuilderLayout;
  /** Whether dialogs may lock the host body's scrolling (layout "page" only). */
  lockBodyScroll: boolean;
  /** Latest host callbacks; read at call time so inline lambdas don't churn context. */
  callbacks: React.RefObject<InstanceCallbacks>;
};

const InstanceContext = createContext<InstanceContextValue | null>(null);

function resolveRouter(routing: FlowBuilderRouting | undefined, initialRoute: Route | undefined): Router {
  if (routing && typeof routing === 'object') return routing;
  if (routing === 'memory') return createMemoryRouter(initialRoute ?? DEFAULT_ROUTE);
  return createHashRouter();
}

export function InstanceProvider({
  routing,
  initialRoute,
  onNavigate,
  storage,
  storageKey = DEFAULT_STORAGE_KEY,
  layout = 'page',
  onTitleChange,
  onDirtyChange,
  children,
}: FlowBuilderInstanceOptions & { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Created once per instance. Changing `routing`/`storage` after mount is
  // ignored on purpose: swapping either mid-session would orphan state.
  const [router] = useState(() => resolveRouter(routing, initialRoute));
  const [adapter] = useState<StorageAdapter>(() => storage ?? createLocalStorageAdapter());
  const instanceStorage = useMemo(() => createInstanceStorage(adapter, storageKey), [adapter, storageKey]);
  const [flowJsonCache] = useState(createFlowJsonCache);
  const [syncBus] = useState(createFlowSyncBus);

  const callbacks = useRef<InstanceCallbacks>({ onNavigate, onTitleChange, onDirtyChange });
  callbacks.current = { onNavigate, onTitleChange, onDirtyChange };

  useEffect(() => {
    const unsubscribe = router.subscribe((route) => callbacks.current.onNavigate?.(route));
    const stop = router.start?.();
    return () => {
      unsubscribe();
      stop?.();
    };
  }, [router]);

  const getRoot = useCallback(() => rootRef.current, []);

  const value = useMemo<InstanceContextValue>(
    () => ({
      rootRef,
      getRoot,
      router,
      storage: instanceStorage,
      flowJsonCache,
      syncBus,
      layout,
      lockBodyScroll: layout === 'page',
      callbacks,
    }),
    [getRoot, router, instanceStorage, flowJsonCache, syncBus, layout],
  );

  return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>;
}

/**
 * Re-points navigation for one subtree. Everything else (storage, caches, root
 * ref, sync bus) is inherited from the enclosing instance. The composable
 * pieces use it so a page's navigation requests reach host callbacks instead
 * of changing a route.
 */
export function RouterOverride({ router, children }: { router: Router; children: React.ReactNode }) {
  const parent = useInstance();
  const value = useMemo<InstanceContextValue>(() => ({ ...parent, router }), [parent, router]);
  return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>;
}

/**
 * A router that is pinned to `route` and forwards every navigation request to
 * `onNavigate` instead of performing it.
 */
export function createInterceptingRouter(route: Route, onNavigate: (route: Route) => void): Router {
  return {
    current: () => route,
    navigate: (next) => onNavigate(next),
    subscribe: () => () => {},
  };
}

export function useInstance(): InstanceContextValue {
  const ctx = useContext(InstanceContext);
  if (!ctx) throw new Error('Flow Builder components must be rendered inside FlowBuilderEntry (InstanceProvider).');
  return ctx;
}

/** The instance's current route; re-renders on change. */
export function useRoute(): Route {
  const { router } = useInstance();
  return useSyncExternalStore(router.subscribe, router.current, router.current);
}

/** Navigate this instance (never another builder on the page). */
export function useNavigate(): (route: Route, options?: NavigateOptions) => void {
  const { router } = useInstance();
  return useCallback((route: Route, options?: NavigateOptions) => router.navigate(route, options), [router]);
}

export function useInstanceStorage(): InstanceStorage {
  return useInstance().storage;
}

export function useFlowSyncBus(): FlowSyncBus {
  return useInstance().syncBus;
}

export function useFlowJsonCache(): FlowJsonCache {
  return useInstance().flowJsonCache;
}

/**
 * Report the current page's title to the host. On unmount it reports `null`,
 * so pages without a title of their own (library, settings) fall back to the
 * host's default — the old "restore the previous document.title" behaviour.
 */
export function useDocumentTitle(title: string | null): void {
  const { callbacks } = useInstance();
  useEffect(() => {
    callbacks.current.onTitleChange?.(title);
  }, [callbacks, title]);
  useEffect(() => () => callbacks.current.onTitleChange?.(null), [callbacks]);
}

/** Report the editor's unsaved-changes state; resets to false on unmount. */
export function useReportDirty(dirty: boolean): void {
  const { callbacks } = useInstance();
  useEffect(() => {
    callbacks.current.onDirtyChange?.(dirty);
  }, [callbacks, dirty]);
  useEffect(() => () => callbacks.current.onDirtyChange?.(false), [callbacks]);
}
