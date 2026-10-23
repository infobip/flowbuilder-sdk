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
import { filterFlows, categoryFilterOptions, categoryLabel, EMPTY_FILTER, matchesLibraryStatus } from './library.ts';
import { createI18n } from '../i18n/I18nProvider.tsx';
import type { ManagedFlow } from '../types/flowBuilder.ts';

const { t } = createI18n();

function flow(partial: Partial<ManagedFlow> & Pick<ManagedFlow, 'id' | 'displayName'>): ManagedFlow {
  return {
    name: partial.displayName,
    responseId: null,
    status: 'DRAFT',
    categories: [],
    updatedAt: null,
    ...partial,
  };
}

const FLOWS: ManagedFlow[] = [
  flow({ id: '1', displayName: 'Appointment booking', categories: ['APPOINTMENT_BOOKING'], status: 'DRAFT' }),
  flow({ id: '2', displayName: 'Lead capture', categories: ['LEAD_GENERATION'], status: 'PUBLISHED' }),
  flow({ id: '3', displayName: 'Booking follow-up', categories: ['CUSTOMER_SUPPORT'], status: 'DEPRECATED' }),
];

test('filterFlows: empty filter returns everything, order preserved', () => {
  assert.deepEqual(filterFlows(FLOWS, EMPTY_FILTER).map((f) => f.id), ['1', '2', '3']);
});

test('filterFlows: search matches display name and id case-insensitively', () => {
  assert.deepEqual(filterFlows(FLOWS, { search: 'booking', status: 'ALL', category: 'ALL' }).map((f) => f.id), ['1', '3']);
  assert.deepEqual(filterFlows(FLOWS, { search: 'LEAD', status: 'ALL', category: 'ALL' }).map((f) => f.id), ['2']);
  assert.deepEqual(filterFlows(FLOWS, { search: '2', status: 'ALL', category: 'ALL' }).map((f) => f.id), ['2']);
});

test('filterFlows: status and category filters combine', () => {
  assert.deepEqual(filterFlows(FLOWS, { search: '', status: 'DRAFT', category: 'ALL' }).map((f) => f.id), ['1']);
  assert.deepEqual(filterFlows(FLOWS, { search: '', status: 'PUBLISHED', category: 'ALL' }).map((f) => f.id), ['2']);
  assert.deepEqual(filterFlows(FLOWS, { search: 'booking', status: 'DRAFT', category: 'APPOINTMENT_BOOKING' }).map((f) => f.id), ['1']);
});

test('filterFlows: no matches yields an empty array', () => {
  assert.deepEqual(filterFlows(FLOWS, { search: 'nothing', status: 'ALL', category: 'ALL' }), []);
});

test('categoryLabel: resolves known categories to friendly labels', () => {
  assert.equal(categoryLabel('APPOINTMENT_BOOKING', t), 'Appointment Booking');
  assert.equal(categoryLabel('LEAD_GENERATION', t), 'Lead Generation');
});

test('categoryLabel: an unknown category shows as its code', () => {
  assert.equal(categoryLabel('MYSTERY' as never, t), 'MYSTERY');
});

test('categoryFilterOptions: all categories first, then every known one', () => {
  const options = categoryFilterOptions(t);
  assert.deepEqual(options[0], { value: 'ALL', label: 'All categories' });
  assert.deepEqual(options[options.length - 1], { value: 'OTHER', label: 'Other' });
  assert.equal(options.length, 9);
});

test('matchesLibraryStatus: drafts include none; published is exact', () => {
  assert.equal(matchesLibraryStatus('DRAFT', 'DRAFT'), true);
  assert.equal(matchesLibraryStatus('none', 'DRAFT'), true);
  assert.equal(matchesLibraryStatus('PUBLISHED', 'PUBLISHED'), true);
  assert.equal(matchesLibraryStatus('DEPRECATED', 'PUBLISHED'), false);
  assert.equal(matchesLibraryStatus('DEPRECATED', 'ALL'), true);
});
