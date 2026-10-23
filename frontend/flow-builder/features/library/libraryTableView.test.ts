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
  DEFAULT_LIBRARY_LAYOUT,
  DEFAULT_LIBRARY_SORT,
  DEFAULT_LIBRARY_TABLE_PAGE_SIZE,
  LIBRARY_TABLE_COLUMNS,
  LIBRARY_TABLE_PAGE_SIZES,
  nextLibrarySort,
  parseLibraryLayout,
  parseLibraryTablePageSize,
  readStoredLibraryLayout,
  readStoredLibraryTablePageSize,
  sortLibraryFlows,
  toLibraryTableRow,
  writeStoredLibraryLayout,
  writeStoredLibraryTablePageSize,
} from './libraryTableView.ts';
import type { FlowCategory, ManagedFlow } from '../../types/flowBuilder.ts';
import { createI18n } from '../../i18n/I18nProvider.tsx';
import { createInstanceStorage, createLocalStorageAdapter } from '../../services/storage.ts';

// The builder's default storage: localStorage under the `flowbuilder`
// namespace. It resolves `window.localStorage` on every call, so the stub
// below is picked up — and the raw-key assertions double as the proof that
// standalone users' existing `flowbuilder_*` keys still read unchanged.
const storage = createInstanceStorage(createLocalStorageAdapter());

const { t } = createI18n();

function flow(
  id: string,
  status: ManagedFlow['status'],
  extra: { name?: string; updatedAt?: string | null; categories?: FlowCategory[] } = {},
): ManagedFlow {
  return {
    id,
    name: extra.name ?? id,
    displayName: extra.name ?? id,
    responseId: null,
    status,
    categories: extra.categories ?? [],
    updatedAt: extra.updatedAt ?? null,
  };
}

// Minimal in-memory localStorage stub, matching services/chatHistory.test.ts,
// plus the read- and write-failure modes the layout accessors catch: a storage
// that throws on access (private mode) or on write (quota).
function installStorage(options: { failReads?: boolean; failWrites?: boolean } = {}): { store: Map<string, string> } {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => {
      if (options.failReads) throw new Error('SecurityError');
      return store.has(key) ? store.get(key)! : null;
    },
    setItem: (key: string, value: string) => {
      if (options.failWrites) throw new Error('QuotaExceededError');
      store.set(key, String(value));
    },
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return { store };
}

function resetStorage(): void {
  delete (globalThis as { window?: unknown }).window;
}

test('the table always shows the flow name and its status', () => {
  const keys = LIBRARY_TABLE_COLUMNS.map((column) => column.key);
  assert.ok(keys.includes('name'));
  assert.ok(keys.includes('status'));
  // The name is the row header, so it has to come first.
  assert.equal(keys[0], 'name');
});

test('only name, status and updated are sortable', () => {
  const sortable = LIBRARY_TABLE_COLUMNS.filter((column) => column.sortKey != null).map((column) => column.key);
  assert.deepEqual(sortable, ['name', 'status', 'updated']);
});

test('parseLibraryLayout falls back to the grid for anything unexpected', () => {
  assert.equal(parseLibraryLayout('table'), 'table');
  assert.equal(parseLibraryLayout('grid'), 'grid');
  assert.equal(parseLibraryLayout(null), DEFAULT_LIBRARY_LAYOUT);
  assert.equal(parseLibraryLayout('list'), DEFAULT_LIBRARY_LAYOUT);
  assert.equal(parseLibraryLayout(undefined), DEFAULT_LIBRARY_LAYOUT);
});

test('the layout choice round-trips through localStorage', () => {
  const { store } = installStorage();
  try {
    assert.equal(readStoredLibraryLayout(storage), DEFAULT_LIBRARY_LAYOUT);
    writeStoredLibraryLayout(storage, 'table');
    assert.equal(store.get('flowbuilder_library_layout'), 'table');
    assert.equal(readStoredLibraryLayout(storage), 'table');
  } finally {
    resetStorage();
  }
});

test('a missing window leaves the layout at its default', () => {
  resetStorage();
  writeStoredLibraryLayout(storage, 'table');
  assert.equal(readStoredLibraryLayout(storage), DEFAULT_LIBRARY_LAYOUT);
});

test('a layout name this build no longer knows reads as the default', () => {
  const { store } = installStorage();
  try {
    store.set('flowbuilder_library_layout', 'list');
    assert.equal(readStoredLibraryLayout(storage), DEFAULT_LIBRARY_LAYOUT);
  } finally {
    resetStorage();
  }
});

test('a storage that throws on read leaves the layout at its default', () => {
  installStorage({ failReads: true });
  try {
    assert.equal(readStoredLibraryLayout(storage), DEFAULT_LIBRARY_LAYOUT);
  } finally {
    resetStorage();
  }
});

test('a storage that throws on write is swallowed — the choice just does not survive the reload', () => {
  const { store } = installStorage({ failWrites: true });
  try {
    // The write reports nothing back, so the whole contract is that the toggle
    // that triggered it does not take the library down with it.
    assert.doesNotThrow(() => writeStoredLibraryLayout(storage, 'table'));
    assert.equal(store.has('flowbuilder_library_layout'), false);
    assert.equal(readStoredLibraryLayout(storage), DEFAULT_LIBRARY_LAYOUT);
  } finally {
    resetStorage();
  }
});

test('the default rows-per-page is one of the offered sizes', () => {
  // The control would otherwise show a value none of its options match, and
  // silently highlight the first one instead.
  assert.ok(LIBRARY_TABLE_PAGE_SIZES.includes(DEFAULT_LIBRARY_TABLE_PAGE_SIZE));
  assert.deepEqual([...LIBRARY_TABLE_PAGE_SIZES], [...LIBRARY_TABLE_PAGE_SIZES].sort((a, b) => a - b));
});

test('parseLibraryTablePageSize accepts an offered size as a number or a string', () => {
  for (const size of LIBRARY_TABLE_PAGE_SIZES) {
    assert.equal(parseLibraryTablePageSize(size), size);
    // The control hands its value back as a string.
    assert.equal(parseLibraryTablePageSize(String(size)), size);
  }
});

test('parseLibraryTablePageSize falls back to the default for anything else', () => {
  for (const value of [null, undefined, '', '   ', 'twenty', 0, -10, 15, 1000, NaN, {}, []]) {
    assert.equal(parseLibraryTablePageSize(value), DEFAULT_LIBRARY_TABLE_PAGE_SIZE);
  }
});

test('the rows-per-page choice round-trips through localStorage', () => {
  const { store } = installStorage();
  try {
    assert.equal(readStoredLibraryTablePageSize(storage), DEFAULT_LIBRARY_TABLE_PAGE_SIZE);
    writeStoredLibraryTablePageSize(storage, 50);
    assert.equal(store.get('flowbuilder_library_table_page_size'), '50');
    assert.equal(readStoredLibraryTablePageSize(storage), 50);
  } finally {
    resetStorage();
  }
});

test('a missing window leaves the rows-per-page at its default', () => {
  resetStorage();
  writeStoredLibraryTablePageSize(storage, 25);
  assert.equal(readStoredLibraryTablePageSize(storage), DEFAULT_LIBRARY_TABLE_PAGE_SIZE);
});

test('a rows-per-page this build no longer offers reads as the default', () => {
  const { store } = installStorage();
  try {
    store.set('flowbuilder_library_table_page_size', '100');
    assert.equal(readStoredLibraryTablePageSize(storage), DEFAULT_LIBRARY_TABLE_PAGE_SIZE);
  } finally {
    resetStorage();
  }
});

test('a storage that throws on read leaves the rows-per-page at its default', () => {
  const { store } = installStorage({ failReads: true });
  try {
    // Seeded with a size that is not the default, so the assertion fails if the
    // fallback ever starts returning whatever happens to be in storage.
    store.set('flowbuilder_library_table_page_size', '50');
    assert.equal(readStoredLibraryTablePageSize(storage), DEFAULT_LIBRARY_TABLE_PAGE_SIZE);
  } finally {
    resetStorage();
  }
});

test('a storage that throws on write does not take the rows-per-page control down', () => {
  const { store } = installStorage({ failWrites: true });
  try {
    assert.doesNotThrow(() => writeStoredLibraryTablePageSize(storage, 25));
    assert.equal(store.has('flowbuilder_library_table_page_size'), false);
    assert.equal(readStoredLibraryTablePageSize(storage), DEFAULT_LIBRARY_TABLE_PAGE_SIZE);
  } finally {
    resetStorage();
  }
});

test('toLibraryTableRow mirrors the card gates: edit/delete on drafts, view on published', () => {
  const draft = toLibraryTableRow(flow('a', 'DRAFT'), t);
  assert.deepEqual(
    { edit: draft.canEdit, view: draft.canView, publish: draft.canPublish, delete: draft.canDelete },
    { edit: true, view: false, publish: true, delete: true },
  );

  const published = toLibraryTableRow(flow('b', 'PUBLISHED'), t);
  assert.deepEqual(
    { edit: published.canEdit, view: published.canView, publish: published.canPublish, delete: published.canDelete },
    { edit: false, view: true, publish: false, delete: false },
  );

  const blocked = toLibraryTableRow(flow('c', 'BLOCKED'), t);
  assert.equal(blocked.canDelete, false);
});

test('toLibraryTableRow presents status, categories and the timestamp', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  const row = toLibraryTableRow(
    flow('a', 'DRAFT', { name: 'Booking', updatedAt: '2026-08-29T12:00:00Z', categories: ['SURVEY'] }),
    t,
    undefined,
    now,
  );
  assert.deepEqual(row.status, { label: 'Draft', tone: 'warning' });
  assert.deepEqual(row.categories, ['Survey']);
  assert.equal(row.updated, '2 days ago');

  const bare = toLibraryTableRow(flow('b', 'PUBLISHED'), t, undefined, now);
  assert.deepEqual(bare.categories, ['Uncategorized']);
  assert.equal(bare.updated, '—');
});

test('sorting by name is alphabetical and reversible', () => {
  const flows = [flow('1', 'DRAFT', { name: 'Charlie' }), flow('2', 'DRAFT', { name: 'alpha' }), flow('3', 'DRAFT', { name: 'Bravo' })];

  const asc = sortLibraryFlows(flows, { key: 'name', direction: 'asc' });
  assert.deepEqual(asc.map((item) => item.displayName), ['alpha', 'Bravo', 'Charlie']);

  const desc = sortLibraryFlows(flows, { key: 'name', direction: 'desc' });
  assert.deepEqual(desc.map((item) => item.displayName), ['Charlie', 'Bravo', 'alpha']);
});

test('sorting by status follows the lifecycle, with names breaking ties', () => {
  const flows = [
    flow('1', 'PUBLISHED', { name: 'Zebra' }),
    flow('2', 'DRAFT', { name: 'Yak' }),
    flow('3', 'PUBLISHED', { name: 'Ant' }),
  ];

  assert.deepEqual(
    sortLibraryFlows(flows, { key: 'status', direction: 'asc' }).map((item) => item.displayName),
    ['Yak', 'Ant', 'Zebra'],
  );
  assert.deepEqual(
    sortLibraryFlows(flows, { key: 'status', direction: 'desc' }).map((item) => item.displayName),
    ['Ant', 'Zebra', 'Yak'],
  );
});

test('sorting by updated puts flows without a timestamp last when newest-first', () => {
  const flows = [
    flow('old', 'DRAFT', { updatedAt: '2026-01-01T00:00:00Z' }),
    flow('none', 'DRAFT', { updatedAt: null }),
    flow('new', 'DRAFT', { updatedAt: '2026-06-01T00:00:00Z' }),
    flow('broken', 'DRAFT', { updatedAt: 'not-a-date' }),
  ];

  assert.deepEqual(
    sortLibraryFlows(flows, { key: 'updated', direction: 'desc' }).map((item) => item.id),
    ['new', 'old', 'broken', 'none'],
  );
});

test('sorting never mutates the input', () => {
  const flows = [flow('b', 'DRAFT', { name: 'Beta' }), flow('a', 'DRAFT', { name: 'Alpha' })];
  sortLibraryFlows(flows, { key: 'name', direction: 'asc' });
  assert.deepEqual(flows.map((item) => item.id), ['b', 'a']);
});

test('clicking a header flips it; moving columns starts in the useful direction', () => {
  assert.deepEqual(nextLibrarySort({ key: 'name', direction: 'asc' }, 'name'), { key: 'name', direction: 'desc' });
  assert.deepEqual(nextLibrarySort({ key: 'name', direction: 'desc' }, 'name'), { key: 'name', direction: 'asc' });
  // Names read A→Z, timestamps read newest first.
  assert.deepEqual(nextLibrarySort({ key: 'updated', direction: 'desc' }, 'name'), { key: 'name', direction: 'asc' });
  assert.deepEqual(nextLibrarySort({ key: 'name', direction: 'desc' }, 'updated'), { key: 'updated', direction: 'desc' });
  assert.deepEqual(DEFAULT_LIBRARY_SORT, { key: 'updated', direction: 'desc' });
});
