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

// Underlined tab strip: the library's status filter and the editor's
// Prompt / JSON switch. Each renders its own `role="tablist"` markup and takes
// the look from here.

import { cx } from '../../utils/cx';

/** Scrolls sideways instead of wrapping once the layout goes single-column. */
export const UNDERLINE_TABLIST_CLASS =
  'flex flex-auto items-stretch gap-0.5 border-b border-default narrow:overflow-x-auto';

export function underlineTabClassName(active: boolean): string {
  return cx(
    // -mb-px lays the 2px underline over the strip's 1px bottom border.
    '-mb-px inline-flex items-center gap-2 border-b-2 px-3 pt-2 pb-3 font-medium cursor-pointer transition-[color,background-color,border-color]',
    active ? 'border-accent text-default' : 'border-transparent text-muted hover:text-default',
  );
}

/** The count pill inside a tab. */
export function underlineTabCountClassName(active: boolean): string {
  return cx(
    'inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-12 font-bold',
    active ? 'bg-accent-soft text-accent' : 'bg-surface-sunken text-muted',
  );
}
