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

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { Button } from '../components/button/Button';
import { EmptyState } from '../components/empty-state/EmptyState';
import { ErrorState } from '../components/empty-state/ErrorState';
import { SkeletonCard } from '../components/loading/Skeleton';
import { ConfirmDialog } from '../components/dialog/ConfirmDialog';
import { LibraryToolbar } from '../features/library/LibraryToolbar';
import { LibraryCard, LIBRARY_CARD_HEIGHT } from '../features/library/LibraryCard';
import { LibraryTable, LibraryTableSkeleton } from '../features/library/LibraryTable';
import { Select, type SelectOption } from '../components/input/Select';
import { countGridColumns, resolveLibraryPageSize } from '../features/library/libraryView';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_TABLE_PAGE_SIZES,
  parseLibraryTablePageSize,
  readStoredLibraryLayout,
  readStoredLibraryTablePageSize,
  sortLibraryFlows,
  writeStoredLibraryLayout,
  writeStoredLibraryTablePageSize,
  type LibraryLayout,
  type LibraryTablePageSize,
  type LibraryTableSort,
} from '../features/library/libraryTableView';
import { useLibrary } from '../state/useLibrary';
import { EMPTY_FILTER, filterFlows, type LibraryFilter } from '../utils/library';
import { useT, type Translate } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';
import { formatRich } from '../i18n/rich';
import { useFeatures } from '../app/hostConfig';
import { useInstanceStorage, useNavigate } from '../app/instanceContext';
import { isConfirmationAllowed } from '../utils/confirmation';
import { cx } from '../utils/cx';
import type { ManagedFlow } from '../types/flowBuilder';

export type LibraryPageViewProps = {
  flows: ManagedFlow[];
  loading: boolean;
  error: string | null;
  filter: LibraryFilter;
  onFilterChange: (next: LibraryFilter) => void;
  layout: LibraryLayout;
  onLayoutChange: (layout: LibraryLayout) => void;
  tablePageSize: LibraryTablePageSize;
  onTablePageSizeChange: (size: LibraryTablePageSize) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (flow: ManagedFlow) => void;
  onView: (flow: ManagedFlow) => void;
  onPublish: (flow: ManagedFlow) => void;
  onDelete: (flow: ManagedFlow) => void;
  actionsDisabled?: boolean;
};

function CreateFlowCard({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  // The wrapper is the list item, so it becomes the grid cell and the button has
  // to fill it explicitly to stay the same size as the flow cards beside it.
  return (
    <div role="listitem">
      <button
        type="button"
        className="flex flex-col items-center justify-center gap-2.5 w-full rounded border-2 border-dashed border-strong bg-surface p-6 text-default cursor-pointer hover:border-accent"
        style={{ height: LIBRARY_CARD_HEIGHT }}
        onClick={onCreate}
      >
        <span className="grid size-16 place-items-center rounded-full border-2 border-primary text-32 leading-none text-primary" aria-hidden="true">＋</span>
        <span className="text-18 font-semibold">{t('library.createTile.title')}</span>
        <span className="max-w-55 text-center text-subtle">{t('library.createTile.description')}</span>
      </button>
    </div>
  );
}

// The grid is `auto-fill`, so its column count only exists after layout.
// Tracking it lets the page size follow the grid and keep every row complete.
function useGridColumns(element: HTMLElement | null): number {
  const [columns, setColumns] = useState(0);

  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setColumns(countGridColumns(window.getComputedStyle(element).gridTemplateColumns));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return columns;
}

function usePagePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage((current) => {
      const nextPageCount = Math.max(1, Math.ceil(items.length / pageSize));
      return Math.min(current, nextPageCount - 1);
    });
  }, [items.length, pageSize]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const start = page * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { page, pageCount, pageItems, start, setPage };
}

// Labels carry the unit because the trigger is the only thing on screen naming
// the control — "Rows per page" is its accessible name, not visible text.
function rowsPerPageOptions(t: Translate): ReadonlyArray<SelectOption<string>> {
  return LIBRARY_TABLE_PAGE_SIZES.map((size) => ({ value: String(size), label: t('library.pagination.rows', { size }) }));
}

function pageButtonClassName(active: boolean): string {
  return cx(
    'inline-grid h-9 min-w-9 place-items-center rounded border px-2 font-semibold cursor-pointer enabled:hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-45',
    active ? 'border-primary bg-primary text-on-primary' : 'border-default bg-surface text-default',
  );
}

function LibraryPaginationBar({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
  rowsPerPage,
}: {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  /** Omitted by the grid, whose page size is measured rather than chosen. */
  rowsPerPage?: { value: LibraryTablePageSize; onChange: (size: LibraryTablePageSize) => void };
}) {
  const t = useT();
  const rowOptions = useMemo(() => rowsPerPageOptions(t), [t]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4" role="navigation" aria-label={t('library.pagination.label')}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-13 text-subtle">
          {t('library.pagination.range', { start: rangeStart, end: rangeEnd, total })}
        </span>
        {rowsPerPage ? (
          // Sized to the page buttons beside it, and opening upwards: the bar is
          // the last thing on the page, so a menu below it would open into nothing.
          <Select
            size="sm"
            menuPlacement="top"
            className="w-28"
            ariaLabel={t('library.pagination.rowsPerPage')}
            options={rowOptions}
            value={String(rowsPerPage.value)}
            onChange={(value) => rowsPerPage.onChange(parseLibraryTablePageSize(value))}
          />
        ) : null}
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={pageButtonClassName(false)}
            aria-label={t('library.pagination.previous')}
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            ‹
          </button>
          {Array.from({ length: pageCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              className={pageButtonClassName(index === page)}
              aria-current={index === page ? 'page' : undefined}
              onClick={() => onPageChange(index)}
            >
              {index + 1}
            </button>
          ))}
          <button
            type="button"
            className={pageButtonClassName(false)}
            aria-label={t('library.pagination.next')}
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LibraryPageView({
  flows,
  loading,
  error,
  filter,
  onFilterChange,
  layout,
  onLayoutChange,
  tablePageSize,
  onTablePageSizeChange,
  onRefresh,
  onCreate,
  onEdit,
  onView,
  onPublish,
  onDelete,
  actionsDisabled = false,
}: LibraryPageViewProps) {
  const t = useT();
  const [sort, setSort] = useState<LibraryTableSort>(DEFAULT_LIBRARY_SORT);
  const visible = useMemo(() => filterFlows(flows, filter), [flows, filter]);
  // The grid keeps the backend's order; only the table is sortable.
  const ordered = useMemo(
    () => (layout === 'table' ? sortLibraryFlows(visible, sort) : visible),
    [layout, visible, sort],
  );
  const [grid, setGrid] = useState<HTMLDivElement | null>(null);
  const gridPageSize = resolveLibraryPageSize(useGridColumns(grid));
  const pageSize = layout === 'table' ? tablePageSize : gridPageSize;
  const { page, pageCount, pageItems, start, setPage } = usePagePagination(ordered, pageSize);

  // Anything that reorders or re-scopes the list sends you back to page 1;
  // holding page 3 across a re-sort lands you somewhere arbitrary. It watches
  // the chosen table size rather than the resolved one, so that merely
  // resizing the window — which remeasures the grid's — leaves your page alone.
  //
  // Before paint, because the render that changed the size still carries the
  // old page: a stale page against a larger size slices past the end of the
  // list, which would flash an empty table under an impossible "Showing 76-34".
  useLayoutEffect(() => {
    setPage(0);
  }, [filter, layout, sort, tablePageSize, setPage]);

  return (
    <PageBody>
      <PageHeader
        eyebrow={t('library.header.eyebrow')}
        title={t('library.header.title')}
        subtitle={t('library.header.count', { count: flows.length })}
        actions={
          <Button variant="primary" onClick={onCreate}>
            <span aria-hidden="true" className="mr-0.5">＋</span> {t('library.header.createFlow')}
          </Button>
        }
      />

      <LibraryToolbar
        flows={flows}
        filter={filter}
        onChange={onFilterChange}
        onRefresh={onRefresh}
        layout={layout}
        onLayoutChange={onLayoutChange}
      />

      {loading ? (
        layout === 'table' ? (
          <LibraryTableSkeleton />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4 narrow:grid-cols-[1fr]" ref={setGrid} aria-hidden="true">
            {Array.from({ length: pageSize + 1 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        )
      ) : error ? (
        <ErrorState message={error} onRetry={onRefresh} />
      ) : flows.length === 0 ? (
        <EmptyState
          icon={<span className="text-22">◇</span>}
          title={t('library.empty.noFlows.title')}
          message={t('library.empty.noFlows.message')}
          actions={<Button variant="primary" onClick={onCreate}>{t('library.header.createFlow')}</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<span className="text-22">⌕</span>}
          title={t('library.empty.noMatches.title')}
          message={t('library.empty.noMatches.message')}
          actions={<Button variant="ghost" onClick={() => onFilterChange(EMPTY_FILTER)}>{t('library.empty.noMatches.clearFilters')}</Button>}
        />
      ) : (
        <>
          {layout === 'table' ? (
            <LibraryTable
              flows={pageItems}
              sort={sort}
              onSortChange={setSort}
              onEdit={onEdit}
              onView={onView}
              onPublish={onPublish}
              onDelete={onDelete}
              actionsDisabled={actionsDisabled}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4 narrow:grid-cols-[1fr]" ref={setGrid} role="list" aria-label={t('library.listLabel')}>
              <CreateFlowCard onCreate={onCreate} />
              {pageItems.map((flow) => (
                <LibraryCard
                  key={flow.id}
                  flow={flow}
                  onEdit={onEdit}
                  onView={onView}
                  onPublish={onPublish}
                  onDelete={onDelete}
                  actionsDisabled={actionsDisabled}
                />
              ))}
            </div>
          )}
          <LibraryPaginationBar
            page={page}
            pageCount={pageCount}
            rangeStart={ordered.length === 0 ? 0 : start + 1}
            rangeEnd={Math.min(start + pageSize, ordered.length)}
            total={ordered.length}
            onPageChange={setPage}
            rowsPerPage={layout === 'table' ? { value: tablePageSize, onChange: onTablePageSizeChange } : undefined}
          />
        </>
      )}
    </PageBody>
  );
}

export function LibraryPage() {
  const t = useT();
  const features = useFeatures();
  const { flows, loading, error, reload, remove, publish } = useLibrary();
  const navigate = useNavigate();
  const storage = useInstanceStorage();
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);
  // The view owns its ephemeral state (sort, page); the persisted display
  // choices live out here with the other side effects.
  const [layout, setLayout] = useState<LibraryLayout>(() => readStoredLibraryLayout(storage));
  const [tablePageSize, setTablePageSize] = useState<LibraryTablePageSize>(() => readStoredLibraryTablePageSize(storage));
  const [pendingDelete, setPendingDelete] = useState<ManagedFlow | null>(null);
  const [pendingPublish, setPendingPublish] = useState<ManagedFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!features.delete) setPendingDelete(null);
  }, [features.delete]);
  useEffect(() => {
    if (!features.publish) setPendingPublish(null);
  }, [features.publish]);

  const deleteConfirmationOpen = isConfirmationAllowed(features.delete, pendingDelete != null);
  const publishConfirmationOpen = isConfirmationAllowed(features.publish, pendingPublish != null);

  const handleEdit = (flow: ManagedFlow) => navigate({ name: 'flow-edit', flowId: flow.id, mode: 'prompt' });
  const handleView = (flow: ManagedFlow) => navigate({ name: 'flow-preview', flowId: flow.id });
  const handlePublish = (flow: ManagedFlow) => {
    if (!features.publish) return;
    setActionError(null);
    setPendingPublish(flow);
  };
  const handleDelete = (flow: ManagedFlow) => {
    if (!features.delete) return;
    setActionError(null);
    setPendingDelete(flow);
  };
  const handleLayoutChange = (next: LibraryLayout) => {
    setLayout(next);
    writeStoredLibraryLayout(storage, next);
  };
  const handleTablePageSizeChange = (next: LibraryTablePageSize) => {
    setTablePageSize(next);
    writeStoredLibraryTablePageSize(storage, next);
  };

  const confirmDelete = async () => {
    if (!isConfirmationAllowed(features.delete, pendingDelete != null) || !pendingDelete) return;
    setBusy(true);
    setActionError(null);
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setActionError(describeError(t, err, 'library.errors.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmPublish = async () => {
    if (!isConfirmationAllowed(features.publish, pendingPublish != null) || !pendingPublish) return;
    setBusy(true);
    setActionError(null);
    try {
      await publish(pendingPublish.id);
      setPendingPublish(null);
    } catch (err) {
      setActionError(describeError(t, err, 'library.errors.publishFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <LibraryPageView
        flows={flows}
        loading={loading}
        error={error}
        filter={filter}
        onFilterChange={setFilter}
        layout={layout}
        onLayoutChange={handleLayoutChange}
        tablePageSize={tablePageSize}
        onTablePageSizeChange={handleTablePageSizeChange}
        onRefresh={reload}
        onCreate={() => navigate({ name: 'flow-new', mode: 'prompt' })}
        onEdit={handleEdit}
        onView={handleView}
        onPublish={handlePublish}
        onDelete={handleDelete}
        actionsDisabled={busy}
      />

      <ConfirmDialog
        open={deleteConfirmationOpen}
        title={t('library.deleteDialog.title')}
        tone="danger"
        confirmLabel={t('library.deleteDialog.confirm')}
        busy={busy}
        message={
          <div>
            <p className="mb-3.5">
              {formatRich(t('library.deleteDialog.message'), { name: <strong>{pendingDelete?.displayName}</strong> })}
            </p>
            {actionError && <p className="text-danger">{actionError}</p>}
          </div>
        }
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={publishConfirmationOpen}
        title={t('library.publishDialog.title')}
        tone="primary"
        confirmLabel={t('library.publishDialog.confirm')}
        busy={busy}
        message={
          <div>
            <p className="mb-3.5">
              {formatRich(t('library.publishDialog.message'), { name: <strong>{pendingPublish?.displayName}</strong> })}
            </p>
            {actionError && <p className="text-danger">{actionError}</p>}
          </div>
        }
        onConfirm={() => void confirmPublish()}
        onCancel={() => setPendingPublish(null)}
      />
    </>
  );
}
