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

// Pure filtering/derivation helpers for the Flow Library. Kept UI-free so the
// filter behaviour can be unit tested without rendering React.

import { FLOW_CATEGORIES, type FlowCategory } from '../../shared';
import type { ManagedFlow } from '../../services/whatsappFlows';
import type { Translate } from '../i18n/I18nProvider';

const KNOWN_CATEGORIES: ReadonlySet<string> = new Set(FLOW_CATEGORIES.map((c) => c.value));

// A category the catalogue doesn't know (the API may add one) shows as its code.
export function categoryLabel(category: FlowCategory, t: Translate): string {
  return KNOWN_CATEGORIES.has(category) ? t(`library.category.${category}`) : category;
}

export type LibraryStatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED';

export type LibraryFilter = {
  search: string;
  status: LibraryStatusFilter;
  category: FlowCategory | 'ALL';
};

export const EMPTY_FILTER: LibraryFilter = { search: '', status: 'ALL', category: 'ALL' };

export function categoryFilterOptions(t: Translate): ReadonlyArray<{ value: LibraryFilter['category']; label: string }> {
  return [
    { value: 'ALL', label: t('library.toolbar.allCategories') },
    ...FLOW_CATEGORIES.map((c) => ({ value: c.value, label: categoryLabel(c.value, t) })),
  ];
}

export function matchesLibraryStatus(flowStatus: string, filter: LibraryStatusFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'DRAFT') return flowStatus === 'DRAFT' || flowStatus === 'none';
  return flowStatus === filter;
}

// Apply the search text (matches display name, case-insensitive), category and
// status filters to a list of flows. Order is preserved.
export function filterFlows(flows: ReadonlyArray<ManagedFlow>, filter: LibraryFilter): ManagedFlow[] {
  const needle = filter.search.trim().toLowerCase();
  return flows.filter((flow) => {
    const matchesText = needle === '' || flow.displayName.toLowerCase().includes(needle) || flow.id.toLowerCase().includes(needle);
    const matchesCategory = filter.category === 'ALL' || flow.categories.includes(filter.category);
    const matchesStatus = matchesLibraryStatus(flow.status, filter.status);
    return matchesText && matchesCategory && matchesStatus;
  });
}
