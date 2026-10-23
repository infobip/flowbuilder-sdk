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

// ── Flow Builder storage ───────────────────────────────────────────────────
//
// Everything the builder persists in the browser (theme, brand, chat history,
// favourites, library display choices) goes through a `StorageAdapter`, so a
// host page can swap localStorage for sessionStorage, memory or its own
// backend, and through a namespace, so two builders on one page (or a builder
// and the host's own data) never collide.
//
// Keys are `${namespace}_${name}`. With the default namespace `flowbuilder`
// that reproduces the key names the standalone app has always used
// (`flowbuilder_theme`, `flowbuilder_chat_history`, …), so existing users keep
// their data without any migration step.

/** Minimal key/value store the builder persists into. May throw (quota, private mode). */
export type StorageAdapter = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export const DEFAULT_STORAGE_KEY = 'flowbuilder';

/** Every name the builder stores, so the full key set is easy to audit. */
export type StorageName =
  | 'theme'
  | 'brand'
  | 'chat_history'
  | 'favorites'
  | 'library_layout'
  | 'library_table_page_size';

/**
 * The browser's localStorage. Resolved on every call rather than captured, so
 * it is safe to create during server rendering and picks up test stubs.
 */
export function createLocalStorageAdapter(): StorageAdapter {
  const local = (): Storage | null => {
    const w = (globalThis as { window?: { localStorage?: Storage } }).window;
    return w?.localStorage ?? null;
  };
  return {
    get: (key) => local()?.getItem(key) ?? null,
    set: (key, value) => {
      const storage = local();
      if (!storage) throw new Error('localStorage is unavailable');
      storage.setItem(key, value);
    },
    remove: (key) => {
      const storage = local();
      if (!storage) throw new Error('localStorage is unavailable');
      storage.removeItem(key);
    },
  };
}

/** An in-memory adapter: nothing survives a reload. Handy for hosts and tests. */
export function createMemoryStorageAdapter(seed?: Record<string, string>): StorageAdapter {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => void store.set(key, String(value)),
    remove: (key) => void store.delete(key),
  };
}

/**
 * The builder's view of storage: namespaced, and failure-tolerant — reads of a
 * broken store come back empty and writes report false instead of throwing.
 */
export type InstanceStorage = {
  read(name: StorageName): string | null;
  /** False when the write failed (quota, private mode, no storage). */
  write(name: StorageName, value: string): boolean;
  /** False when the removal failed. */
  remove(name: StorageName): boolean;
};

export function storageKeyFor(namespace: string, name: StorageName): string {
  return `${namespace}_${name}`;
}

export function createInstanceStorage(
  adapter: StorageAdapter = createLocalStorageAdapter(),
  namespace: string = DEFAULT_STORAGE_KEY,
): InstanceStorage {
  return {
    read(name) {
      try {
        return adapter.get(storageKeyFor(namespace, name));
      } catch {
        return null;
      }
    },
    write(name, value) {
      try {
        adapter.set(storageKeyFor(namespace, name), value);
        return true;
      } catch {
        return false;
      }
    },
    remove(name) {
      try {
        adapter.remove(storageKeyFor(namespace, name));
        return true;
      } catch {
        return false;
      }
    },
  };
}
