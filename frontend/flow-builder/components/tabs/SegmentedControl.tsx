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

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
};

/**
 * `tabs` switches between views of the same page; `choice` picks a value that
 * is the setting itself. They look identical and differ only in what assistive
 * tech announces — "tab 1 of 2" implies a panel swap that a preference has no
 * business promising.
 */
export type SegmentedSemantics = 'tabs' | 'choice';

export type SegmentedControlProps<T extends string> = {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible label for the whole group. */
  ariaLabel: string;
  /** Defaults to `tabs`, the original view-switching behaviour. */
  semantics?: SegmentedSemantics;
  className?: string;
};

const ITEM_CLASS =
  'inline-flex min-h-9.5 items-center gap-2 rounded-sm px-4 font-medium text-muted cursor-pointer transition-[color,background-color,border-color] hover:text-default ' +
  "aria-selected:bg-surface aria-selected:text-default aria-selected:inset-ring aria-selected:inset-ring-(--fb-border-color-strong) aria-selected:after:size-[5px] aria-selected:after:rounded-full aria-selected:after:bg-accent aria-selected:after:content-['']";

// Segmented control / tab switcher. Used for the editor's Prompt ↔ JSON modes
// and any binary/ternary view toggle. Selected segment shows an orange dot to
// echo the active-indicator language of the navigation rail.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  semantics = 'tabs',
  className,
}: SegmentedControlProps<T>) {
  const asTabs = semantics === 'tabs';
  return (
    <div
      className={cx('inline-flex gap-0.5 rounded border border-default bg-surface-sunken p-[3px]', className)}
      role={asTabs ? 'tablist' : 'radiogroup'}
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={asTabs ? 'tab' : 'radio'}
            // The selected-segment styling keys off `aria-selected`, so the
            // radio form sets it too even though `aria-checked` is what is read.
            aria-selected={selected}
            {...(asTabs ? null : { 'aria-checked': selected })}
            disabled={option.disabled}
            className={ITEM_CLASS}
            onClick={() => !selected && onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
