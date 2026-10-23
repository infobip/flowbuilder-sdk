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
  canEditFlow,
  canDeleteFlow,
  canPublishFlow,
  canViewFlow,
  countGridColumns,
  resolveLibraryPageSize,
} from './libraryView.ts';
import type { ManagedFlow } from '../../types/flowBuilder.ts';

function flow(id: string, status: ManagedFlow['status']): ManagedFlow {
  return {
    id,
    name: id,
    displayName: id,
    responseId: null,
    status,
    categories: [],
    updatedAt: null,
  };
}

test('resolveLibraryPageSize: a page plus the create tile always fills whole rows', () => {
  for (const columns of [1, 2, 3, 4, 5, 6]) {
    const tiles = resolveLibraryPageSize(columns) + 1;
    assert.equal(tiles % columns, 0, `${columns} columns left a ragged row`);
    assert.ok(tiles >= columns, `${columns} columns produced less than one row`);
  }
});

test('resolveLibraryPageSize: keeps 8 flows on the three-column grid and before measuring', () => {
  assert.equal(resolveLibraryPageSize(3), 8);
  assert.equal(resolveLibraryPageSize(0), 8);
  assert.equal(resolveLibraryPageSize(Number.NaN), 8);
  // Two columns take one flow more, four columns push one to the next page.
  assert.equal(resolveLibraryPageSize(2), 9);
  assert.equal(resolveLibraryPageSize(4), 7);
});

test('countGridColumns: counts resolved tracks and ignores unresolved ones', () => {
  assert.equal(countGridColumns('352px 352px 352px'), 3);
  assert.equal(countGridColumns('552.5px 552.5px'), 2);
  assert.equal(countGridColumns('repeat(auto-fill, minmax(360px, 1fr))'), 0);
  assert.equal(countGridColumns('none'), 0);
  assert.equal(countGridColumns(''), 0);
});

test('library actions: edit/delete allowed for drafts, view for published, publish only for drafts', () => {
  assert.equal(canEditFlow(flow('a', 'DRAFT')), true);
  assert.equal(canEditFlow(flow('b', 'PUBLISHED')), false);
  assert.equal(canViewFlow(flow('a', 'DRAFT')), false);
  assert.equal(canViewFlow(flow('b', 'PUBLISHED')), true);
  assert.equal(canDeleteFlow(flow('a', 'DRAFT')), true);
  assert.equal(canDeleteFlow(flow('b', 'PUBLISHED')), false);
  assert.equal(canDeleteFlow(flow('c', 'BLOCKED')), false);
  assert.equal(canPublishFlow(flow('a', 'DRAFT')), true);
  assert.equal(canPublishFlow(flow('b', 'PUBLISHED')), false);
});
