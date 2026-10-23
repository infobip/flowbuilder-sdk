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

import React from 'react';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { useFeatures } from '../../app/hostConfig';
import { Button } from '../../components/button/Button';
import { Badge } from '../../components/badge/Badge';
import { Skeleton } from '../../components/loading/Skeleton';
import type { ManagedFlow } from '../../types/flowBuilder';
import { cx } from '../../utils/cx';
import {
  LIBRARY_TABLE_COLUMNS,
  nextLibrarySort,
  toLibraryTableRow,
  type LibraryTableSort,
  type LibraryTableColumnKey,
  type LibraryTableSortKey,
} from './libraryTableView';

export type LibraryTableProps = {
  /** Already filtered, sorted and paginated by the page. */
  flows: ReadonlyArray<ManagedFlow>;
  sort: LibraryTableSort;
  onSortChange: (sort: LibraryTableSort) => void;
  onEdit: (flow: ManagedFlow) => void;
  onView: (flow: ManagedFlow) => void;
  onPublish: (flow: ManagedFlow) => void;
  onDelete: (flow: ManagedFlow) => void;
  actionsDisabled?: boolean;
};

const SORT_GLYPH: Record<LibraryTableSort['direction'], string> = { asc: '↑', desc: '↓' };

// The border lives on the wrapper so it survives the horizontal scroll a
// narrow viewport forces on the table.
const TABLE_WRAP_CLASS = 'overflow-x-auto rounded border border-default bg-surface';

const TH_CLASS =
  'whitespace-nowrap border-b border-default bg-surface-sunken px-4 text-11 font-bold tracking-[0.9px] text-muted uppercase';

const TH_COLUMN_CLASSES: Record<LibraryTableColumnKey, string> = {
  name: '',
  status: '',
  categories: '',
  updated: 'w-[1%]',
  actions: 'text-right',
};

const TD_CLASS = 'px-4 py-3 align-middle font-normal';

function SortableHeader({
  label,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  sortKey: LibraryTableSortKey;
  sort: LibraryTableSort;
  onSortChange: (sort: LibraryTableSort) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      // The whole header cell is the sort target, so the button fills it rather
      // than leaving a dead strip around a small hit area. The header row sits
      // flush against the scrolling wrapper's clip edge, which would cut an
      // outset focus ring in half — this one draws inward instead.
      className={cx(
        'inline-flex min-h-target w-full items-center gap-1.5 text-left uppercase cursor-pointer transition-[color,background-color,border-color] focus-visible:-outline-offset-2',
        active ? 'text-default' : 'hover:text-default',
      )}
      onClick={() => onSortChange(nextLibrarySort(sort, sortKey))}
    >
      {label}
      {/* The arrow only annotates the header text; aria-sort on the cell is
          what assistive tech reads, so this stays decorative. */}
      <span className={cx('text-12 tracking-[0]', active ? 'text-accent' : 'text-subtle')} aria-hidden="true">
        {active ? SORT_GLYPH[sort.direction] : '↕'}
      </span>
    </button>
  );
}

function FlowRow({
  flow,
  onEdit,
  onView,
  onPublish,
  onDelete,
  actionsDisabled,
}: {
  flow: ManagedFlow;
  onEdit: (flow: ManagedFlow) => void;
  onView: (flow: ManagedFlow) => void;
  onPublish: (flow: ManagedFlow) => void;
  onDelete: (flow: ManagedFlow) => void;
  actionsDisabled: boolean;
}) {
  const t = useT();
  const { locale } = useI18n();
  const row = toLibraryTableRow(flow, t, locale);
  const features = useFeatures();

  return (
    <tr className="border-b border-default last:border-b-0 hover:bg-surface-sunken">
      {/* A row header, so a screen reader prefixes every other cell in the row
          with the flow it belongs to. */}
      <th scope="row" className={cx(TD_CLASS, 'table-cell max-w-90 text-left text-default')}>
        <span className="block text-14 font-semibold wrap-anywhere">{flow.displayName}</span>
        {/* An identifier, not prose — mono, like the JSON and the card ids. */}
        <span className="mt-0.5 block font-mono text-11.5 font-normal text-subtle wrap-anywhere">{flow.id}</span>
      </th>
      <td className={cx(TD_CLASS, 'text-default')}>
        <Badge tone={row.status.tone} dot>{row.status.label}</Badge>
      </td>
      <td className={cx(TD_CLASS, 'text-default')}>
        <div className="flex flex-wrap gap-1.5">
          {row.categories.map((label) => (
            <Badge key={label} tone="neutral">{label}</Badge>
          ))}
        </div>
      </td>
      <td className={cx(TD_CLASS, 'text-13 whitespace-nowrap text-muted')}>{row.updated}</td>
      {/* Every row repeats the same verbs, so each button spells out which flow
          it acts on while the visible label stays short. */}
      <td className={cx(TD_CLASS, 'text-right text-default')}>
        <div className="flex justify-end gap-2">
          {row.canEdit ? (
            <Button size="sm" variant="secondary" aria-label={t('library.actions.editAria', { name: flow.displayName })} onClick={() => onEdit(flow)} disabled={actionsDisabled}>
              {t('library.actions.edit')}
            </Button>
          ) : null}
          {row.canView ? (
            <Button size="sm" variant="secondary" aria-label={t('library.actions.viewAria', { name: flow.displayName })} onClick={() => onView(flow)} disabled={actionsDisabled}>
              {t('library.actions.view')}
            </Button>
          ) : null}
          {features.publish && row.canPublish ? (
            <Button size="sm" variant="primary" aria-label={t('library.actions.publishAria', { name: flow.displayName })} onClick={() => onPublish(flow)} disabled={actionsDisabled}>
              {t('library.actions.publish')}
            </Button>
          ) : null}
          {features.delete && row.canDelete ? (
            <Button size="sm" variant="danger" aria-label={t('library.actions.deleteAria', { name: flow.displayName })} onClick={() => onDelete(flow)} disabled={actionsDisabled}>
              {t('library.actions.delete')}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function LibraryTable({
  flows,
  sort,
  onSortChange,
  onEdit,
  onView,
  onPublish,
  onDelete,
  actionsDisabled = false,
}: LibraryTableProps) {
  const t = useT();
  return (
    <div className={TABLE_WRAP_CLASS}>
      <table className="w-full min-w-215 border-collapse text-left">
        {/* Only ever the current page, so the caption must not promise more.
            Off-canvas rather than hidden, so it still names the table for
            assistive tech without repeating the page heading visually. */}
        <caption className="absolute -m-px size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]">
          {t('library.table.caption')}
        </caption>
        <thead>
          <tr>
            {LIBRARY_TABLE_COLUMNS.map((column) => {
              const sortKey = column.sortKey;
              const label = t(column.labelKey);
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(TH_CLASS, TH_COLUMN_CLASSES[column.key])}
                  aria-sort={sortKey ? (sort.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                >
                  {sortKey ? (
                    <SortableHeader label={label} sortKey={sortKey} sort={sort} onSortChange={onSortChange} />
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {flows.map((flow) => (
            <FlowRow
              key={flow.id}
              flow={flow}
              onEdit={onEdit}
              onView={onView}
              onPublish={onPublish}
              onDelete={onDelete}
              actionsDisabled={actionsDisabled}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stand-in shown while the flow list loads. Rows only — the real header would
// offer sort controls over nothing.
export function LibraryTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={cx(TABLE_WRAP_CLASS, 'flex flex-col gap-4.5 px-4 py-4.5')} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} height={24} />
      ))}
    </div>
  );
}
