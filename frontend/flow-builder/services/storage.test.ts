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
import {
  createInstanceStorage,
  createLocalStorageAdapter,
  createMemoryStorageAdapter,
  DEFAULT_STORAGE_KEY,
  type StorageAdapter,
  type StorageName,
} from './storage.ts';

// Minimal in-memory localStorage stub on a fake `window`, as in chatHistory.test.ts.
function installLocalStorage(seed: Record<string, string> = {}): { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(seed));
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return { store };
}

function resetLocalStorage(): void {
  delete (globalThis as { window?: unknown }).window;
}

const NAMES: StorageName[] = ['theme', 'brand', 'chat_history', 'favorites', 'library_layout', 'library_table_page_size'];

// The exact keys the standalone app wrote before storage was namespaced.
const LEGACY_KEYS = [
  'flowbuilder_theme',
  'flowbuilder_brand',
  'flowbuilder_chat_history',
  'flowbuilder_favorites',
  'flowbuilder_library_layout',
  'flowbuilder_library_table_page_size',
];

test('the default namespace is "flowbuilder"', () => {
  assert.equal(DEFAULT_STORAGE_KEY, 'flowbuilder');
});

test('default storage reads the legacy flowbuilder_* keys unchanged (no data loss)', () => {
  const seed = Object.fromEntries(LEGACY_KEYS.map((key) => [key, `value of ${key}`]));
  installLocalStorage(seed);
  try {
    const storage = createInstanceStorage();
    NAMES.forEach((name, index) => {
      assert.equal(storage.read(name), `value of ${LEGACY_KEYS[index]}`);
    });
  } finally {
    resetLocalStorage();
  }
});

test('default storage writes exactly the legacy key names', () => {
  const { store } = installLocalStorage();
  try {
    const storage = createInstanceStorage(createLocalStorageAdapter());
    for (const name of NAMES) assert.equal(storage.write(name, 'x'), true);
    assert.deepEqual([...store.keys()].sort(), [...LEGACY_KEYS].sort());
  } finally {
    resetLocalStorage();
  }
});

test('a custom namespace prefixes every key and does not see the default data', () => {
  const { store } = installLocalStorage({ flowbuilder_theme: 'dark' });
  try {
    const storage = createInstanceStorage(createLocalStorageAdapter(), 'acme');
    assert.equal(storage.read('theme'), null);
    storage.write('theme', 'light');
    assert.equal(store.get('acme_theme'), 'light');
    assert.equal(store.get('flowbuilder_theme'), 'dark');
  } finally {
    resetLocalStorage();
  }
});

test('two namespaces over one adapter never collide', () => {
  const adapter = createMemoryStorageAdapter();
  const a = createInstanceStorage(adapter, 'a');
  const b = createInstanceStorage(adapter, 'b');
  a.write('favorites', '["A"]');
  b.write('favorites', '["B"]');
  assert.equal(a.read('favorites'), '["A"]');
  assert.equal(b.read('favorites'), '["B"]');
  assert.equal(b.remove('favorites'), true);
  assert.equal(a.read('favorites'), '["A"]');
  assert.equal(b.read('favorites'), null);
});

test('a throwing adapter reads as empty and reports failed writes', () => {
  const broken: StorageAdapter = {
    get: () => {
      throw new Error('SecurityError');
    },
    set: () => {
      throw new Error('QuotaExceededError');
    },
    remove: () => {
      throw new Error('SecurityError');
    },
  };
  const storage = createInstanceStorage(broken);
  assert.equal(storage.read('theme'), null);
  assert.equal(storage.write('theme', 'dark'), false);
  assert.equal(storage.remove('theme'), false);
});

test('without a window, localStorage-backed storage reads null and fails writes quietly', () => {
  resetLocalStorage();
  const storage = createInstanceStorage();
  assert.equal(storage.read('theme'), null);
  assert.equal(storage.write('theme', 'dark'), false);
  assert.equal(storage.remove('theme'), false);
});

test('the memory adapter starts from its seed and forgets nothing until removed', () => {
  const adapter = createMemoryStorageAdapter({ flowbuilder_brand: 'custom' });
  const storage = createInstanceStorage(adapter);
  assert.equal(storage.read('brand'), 'custom');
  storage.write('brand', 'default');
  assert.equal(adapter.get('flowbuilder_brand'), 'default');
});
