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

// Pure logic behind the Flow Library's table view: the column set, how a flow
// becomes a row, how the sort cycles, and how the chosen layout survives a
// reload. UI-free so all of it is unit testable without rendering React.
//
// Sibling of `libraryView.ts`, which does the same for the card grid and still
// owns the action gates — both views must agree on who can edit or delete what.

import type { FlowStatus, ManagedFlow } from '../../types/flowBuilder';
import { presentStatus, type StatusPresentation } from '../../utils/flowStatus';
import { categoryLabel } from '../../utils/library';
import { relativeUpdatedLabel } from '../../utils/dates';
import type { Translate } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import type { InstanceStorage } from '../../services/storage';
import { canDeleteFlow, canEditFlow, canPublishFlow, canViewFlow } from './libraryView';

export type LibraryLayout = 'grid' | 'table';

export const DEFAULT_LIBRARY_LAYOUT: LibraryLayout = 'grid';


export function parseLibraryLayout(value: unknown): LibraryLayout {
  return value === 'grid' || value === 'table' ? value : DEFAULT_LIBRARY_LAYOUT;
}

// Which view you prefer is a display preference, not addressable state: the
// library is a single route and the filters above the list are not in the URL
// either. So it is kept where the theme is kept: the builder instance's
// storage, which reads as empty and swallows failed writes.
export function readStoredLibraryLayout(storage: InstanceStorage): LibraryLayout {
  return parseLibraryLayout(storage.read('library_layout'));
}

export function writeStoredLibraryLayout(storage: InstanceStorage, layout: LibraryLayout): void {
  storage.write('library_layout', layout);
}

/**
 * Rows per page the table view offers. The grid has no equivalent choice: it
 * measures its own column count so every row comes out complete, and a manual
 * size would fight that. Table rows are uniform, so the user picks.
 *
 * 50 is the top of the range rather than an "all" option — the library is small
 * enough that one page of 50 is already the whole list in practice, and keeping
 * every size a real number keeps the page arithmetic free of a sentinel.
 */
export const LIBRARY_TABLE_PAGE_SIZES = [10, 25, 50] as const;

export type LibraryTablePageSize = (typeof LIBRARY_TABLE_PAGE_SIZES)[number];

export const DEFAULT_LIBRARY_TABLE_PAGE_SIZE: LibraryTablePageSize = 10;

// Also the rows-per-page control's onChange guard: a `<select>` hands back a
// string, and storage may hand back a size some past build offered.
export function parseLibraryTablePageSize(value: unknown): LibraryTablePageSize {
  const size = LIBRARY_TABLE_PAGE_SIZES.find((candidate) => candidate === Number(value));
  return size ?? DEFAULT_LIBRARY_TABLE_PAGE_SIZE;
}

export function readStoredLibraryTablePageSize(storage: InstanceStorage): LibraryTablePageSize {
  return parseLibraryTablePageSize(storage.read('library_table_page_size'));
}

// Returns void like `writeStoredLibraryLayout`: both are display preferences,
// and a failed write costs nothing the caller could act on — the choice holds
// for this session and just does not survive the reload.
export function writeStoredLibraryTablePageSize(storage: InstanceStorage, size: LibraryTablePageSize): void {
  storage.write('library_table_page_size', String(size));
}

export type LibraryTableSortKey = 'name' | 'status' | 'updated';
export type LibrarySortDirection = 'asc' | 'desc';
export type LibraryTableSort = { key: LibraryTableSortKey; direction: LibrarySortDirection };

export const DEFAULT_LIBRARY_SORT: LibraryTableSort = { key: 'updated', direction: 'desc' };

export type LibraryTableColumnKey = 'name' | 'status' | 'categories' | 'updated' | 'actions';

export type LibraryTableColumn = {
  key: LibraryTableColumnKey;
  labelKey: MessageKey;
  /** Columns with a sort key render a header button; the rest are plain. */
  sortKey: LibraryTableSortKey | null;
};

// The flow id rides under its name rather than taking a column of its own —
// it is a long machine string and would crowd out everything readable.
export const LIBRARY_TABLE_COLUMNS: ReadonlyArray<LibraryTableColumn> = [
  { key: 'name', labelKey: 'library.table.columns.name', sortKey: 'name' },
  { key: 'status', labelKey: 'library.table.columns.status', sortKey: 'status' },
  { key: 'categories', labelKey: 'library.table.columns.categories', sortKey: null },
  { key: 'updated', labelKey: 'library.table.columns.updated', sortKey: 'updated' },
  { key: 'actions', labelKey: 'library.table.columns.actions', sortKey: null },
];

export type LibraryTableRow = {
  flow: ManagedFlow;
  status: StatusPresentation;
  categories: string[];
  updated: string;
  canEdit: boolean;
  canView: boolean;
  canPublish: boolean;
  canDelete: boolean;
};

export function toLibraryTableRow(flow: ManagedFlow, t: Translate, locale?: string, now?: Date): LibraryTableRow {
  return {
    flow,
    status: presentStatus(flow.status, t),
    categories:
      flow.categories.length === 0
        ? [t('library.category.uncategorized')]
        : flow.categories.map((category) => categoryLabel(category, t)),
    updated: relativeUpdatedLabel(flow.updatedAt, t, locale, now),
    canEdit: canEditFlow(flow),
    canView: canViewFlow(flow),
    canPublish: canPublishFlow(flow),
    canDelete: canDeleteFlow(flow),
  };
}

// Status sorts by lifecycle position, not label: flows that still need work
// lead, terminal states trail. Alphabetical order would interleave them.
const STATUS_RANK: Record<FlowStatus, number> = {
  none: 0,
  DRAFT: 1,
  PUBLISHED: 2,
  THROTTLED: 3,
  BLOCKED: 4,
  DEPRECATED: 5,
};

function statusRank(status: FlowStatus): number {
  return STATUS_RANK[status] ?? 0;
}

/** Epoch ms, or 0 for a flow the backend gave no usable timestamp for. */
function updatedAtMs(flow: ManagedFlow): number {
  if (!flow.updatedAt) return 0;
  const parsed = new Date(flow.updatedAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareNames(a: ManagedFlow, b: ManagedFlow): number {
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

function compareBy(a: ManagedFlow, b: ManagedFlow, key: LibraryTableSortKey): number {
  switch (key) {
    case 'name':
      return compareNames(a, b);
    case 'status':
      return statusRank(a.status) - statusRank(b.status);
    case 'updated':
      return updatedAtMs(a) - updatedAtMs(b);
  }
}

export function sortLibraryFlows(
  flows: ReadonlyArray<ManagedFlow>,
  sort: LibraryTableSort,
): ManagedFlow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...flows].sort((a, b) => {
    const primary = compareBy(a, b, sort.key);
    // Name always breaks ties ascending, so equal statuses or timestamps land
    // in a readable order instead of whatever order the backend listed them.
    return primary !== 0 ? primary * factor : compareNames(a, b);
  });
}

// Clicking the active column flips it; moving to another column starts in the
// direction that column is most useful in — names A→Z, timestamps newest first.
export function nextLibrarySort(current: LibraryTableSort, key: LibraryTableSortKey): LibraryTableSort {
  if (current.key !== key) return { key, direction: key === 'updated' ? 'desc' : 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}
