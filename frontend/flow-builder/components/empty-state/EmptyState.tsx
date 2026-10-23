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
import { cx } from '../../utils/cx';

export type EmptyStateProps = {
  title: string;
  message?: React.ReactNode;
  /** Leading glyph/icon node. */
  icon?: React.ReactNode;
  /** Primary/secondary actions row. */
  actions?: React.ReactNode;
};

/** Layout shared with ErrorState, which only swaps the tone of the frame and icon. */
export const STATE_CLASSES = {
  root: 'flex flex-col items-center gap-3 rounded border px-6 py-14 text-center',
  icon: 'grid size-12 place-items-center rounded',
  title: 'text-16 font-semibold text-default',
  message: 'max-w-[420px] text-13 text-muted',
  actions: 'mt-1 flex items-center gap-2.5',
} as const;

// Neutral empty state used when a collection (e.g. the flow library) has no
// items or a search returns nothing.
export function EmptyState({ title, message, icon, actions }: EmptyStateProps) {
  return (
    <div className={cx(STATE_CLASSES.root, 'border-dashed border-default bg-surface')} role="status">
      {icon != null && <div className={cx(STATE_CLASSES.icon, 'bg-surface-sunken text-muted')} aria-hidden="true">{icon}</div>}
      <h3 className={STATE_CLASSES.title}>{title}</h3>
      {message && <p className={STATE_CLASSES.message}>{message}</p>}
      {actions && <div className={STATE_CLASSES.actions}>{actions}</div>}
    </div>
  );
}
