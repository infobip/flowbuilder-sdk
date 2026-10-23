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

import type { ManagedFlow } from '../../types/flowBuilder';
import { canDelete as canDeleteFlowStatus, canPublish as canPublishFlowStatus } from '../../utils/flowStatus';

/** Tiles a page aims to show, counting the "Create a new flow" tile. */
export const LIBRARY_TILE_TARGET = 9;

/**
 * How many flows a page may hold so the grid is always a complete rectangle.
 * The create tile takes a slot on every page, so the flow count lands one short
 * of a whole number of rows. The row count is rounded to whichever fits the
 * target best, which is why a two-column grid takes one flow more per page and
 * a four-column grid pushes one onto the next page.
 */
export function resolveLibraryPageSize(columns: number, tileTarget = LIBRARY_TILE_TARGET): number {
  if (!Number.isFinite(columns) || columns < 1) return tileTarget - 1;
  const gridColumns = Math.floor(columns);
  const rows = Math.max(1, Math.round(tileTarget / gridColumns));
  return rows * gridColumns - 1;
}

/**
 * Column count from a computed `grid-template-columns` ("352px 352px 352px").
 * Returns 0 while the value is still the unresolved `repeat(auto-fill, …)`
 * authored form, which happens before the grid has been laid out.
 */
export function countGridColumns(trackList: string): number {
  const tracks = trackList.trim();
  if (!tracks || tracks === 'none' || tracks.includes('(')) return 0;
  return tracks.split(/\s+/).length;
}

export function canEditFlow(flow: ManagedFlow): boolean {
  return flow.status === 'DRAFT';
}

export function canViewFlow(flow: ManagedFlow): boolean {
  return flow.status === 'PUBLISHED';
}

export function canDeleteFlow(flow: ManagedFlow): boolean {
  return canDeleteFlowStatus(flow.status);
}

export function canPublishFlow(flow: ManagedFlow): boolean {
  return canPublishFlowStatus(flow.status);
}
