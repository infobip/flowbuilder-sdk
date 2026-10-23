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

import React, { useMemo } from 'react';
import { Button } from '../../components/button/Button';
import { Select } from '../../components/input/Select';
import { CONTROL_CLASS, controlToneClass } from '../../components/input/Field';
import { SegmentedControl } from '../../components/tabs/SegmentedControl';
import {
  UNDERLINE_TABLIST_CLASS,
  underlineTabClassName,
  underlineTabCountClassName,
} from '../../components/tabs/underlineTabs';
import { useT } from '../../i18n/I18nProvider';
import type { ManagedFlow } from '../../types/flowBuilder';
import {
  categoryFilterOptions,
  matchesLibraryStatus,
  type LibraryFilter,
  type LibraryStatusFilter,
} from '../../utils/library';
import { cx } from '../../utils/cx';
import type { LibraryLayout } from './libraryTableView';

export type LibraryToolbarProps = {
  flows: ReadonlyArray<ManagedFlow>;
  filter: LibraryFilter;
  onChange: (next: LibraryFilter) => void;
  onRefresh: () => void;
  layout: LibraryLayout;
  onLayoutChange: (layout: LibraryLayout) => void;
};

const STATUS_FILTERS: ReadonlyArray<LibraryStatusFilter> = ['ALL', 'DRAFT', 'PUBLISHED'];
const LAYOUTS: ReadonlyArray<LibraryLayout> = ['grid', 'table'];

// Underlined status tabs (with counts) + search + category filter + layout
// switch for the Flow Library. Counts are derived from *all* flows so they stay
// stable regardless of the active tab or search text.
export function LibraryToolbar({ flows, filter, onChange, onRefresh, layout, onLayoutChange }: LibraryToolbarProps) {
  const t = useT();
  const statusOptions = STATUS_FILTERS.map((value) => ({ value, label: t(`library.statusFilter.${value}`) }));
  const layoutOptions = LAYOUTS.map((value) => ({ value, label: t(`library.layout.${value}`) }));
  const categoryOptions = useMemo(() => categoryFilterOptions(t), [t]);
  const counts = useMemo(() => {
    const result: Record<LibraryStatusFilter, number> = { ALL: 0, DRAFT: 0, PUBLISHED: 0 };
    for (const value of STATUS_FILTERS) {
      result[value] = flows.reduce(
        (total, flow) => total + (matchesLibraryStatus(flow.status, value) ? 1 : 0),
        0,
      );
    }
    return result;
  }, [flows]);

  return (
    <section
      className="relative z-3 flex flex-col gap-3.5 rounded border border-default bg-[linear-gradient(180deg,var(--fb-color-surface-raised),var(--fb-color-surface))] p-4 narrow:items-stretch"
      aria-label={t('library.toolbar.label')}
    >
      <div className={UNDERLINE_TABLIST_CLASS} role="tablist" aria-label={t('library.toolbar.statusTabs')}>
        {statusOptions.map((option) => {
          const active = filter.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={underlineTabClassName(active)}
              onClick={() => onChange({ ...filter, status: option.value })}
            >
              {option.label}
              <span className={underlineTabCountClassName(active)}>{counts[option.value]}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(200px,260px)_auto_auto] items-center gap-3 narrow:grid-cols-[1fr]">
        <div className="relative flex min-w-0 items-center narrow:w-full">
          <span className="pointer-events-none absolute left-3 text-15 text-subtle" aria-hidden="true">⌕</span>
          <input
            className={cx(CONTROL_CLASS, controlToneClass(false), 'min-h-target min-w-0 py-2.5 pr-3 pl-9')}
            type="search"
            aria-label={t('library.toolbar.searchLabel')}
            placeholder={t('library.toolbar.searchPlaceholder')}
            value={filter.search}
            onChange={(event) => onChange({ ...filter, search: event.target.value })}
          />
        </div>

        <Select
          className="w-full"
          ariaLabel={t('library.toolbar.categoryFilter')}
          options={categoryOptions}
          value={filter.category}
          onChange={(category) => onChange({ ...filter, category })}
        />

        {/* A preference, not a tab strip — nothing behind it is a panel. */}
        <SegmentedControl
          className="justify-self-end narrow:flex narrow:w-full narrow:min-w-0 narrow:justify-self-stretch narrow:*:flex-1 narrow:*:justify-center"
          ariaLabel={t('library.toolbar.layoutLabel')}
          semantics="choice"
          options={layoutOptions}
          value={layout}
          onChange={onLayoutChange}
        />

        <Button
          type="button"
          variant="secondary"
          className="min-w-33 justify-self-end narrow:w-full narrow:min-w-0 narrow:justify-self-stretch"
          startSlot={<span aria-hidden="true">↻</span>}
          onClick={onRefresh}
        >
          {t('library.toolbar.refresh')}
        </Button>
      </div>
    </section>
  );
}
