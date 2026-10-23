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

export type NavItem = {
  key: string;
  label: string;
  /** Leading glyph/icon node. */
  icon?: React.ReactNode;
  disabled?: boolean;
};

export type NavigationRailProps = {
  brand: React.ReactNode;
  items: ReadonlyArray<NavItem>;
  activeKey: string;
  onSelect: (key: string) => void;
  /** Content pinned to the bottom of the rail (e.g. theme switch). */
  footer?: React.ReactNode;
  /** The landmark's accessible name. */
  label: string;
};

// The active item is styled off `aria-current`, including its orange indicator bar.
const ITEM_CLASS =
  'relative flex min-h-target items-center gap-3 rounded px-3 text-left font-medium text-nav-text-muted cursor-pointer transition-[color,background-color,border-color] hover:bg-nav-hover hover:text-nav-text ' +
  "aria-[current=page]:bg-nav-surface aria-[current=page]:text-nav-text aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:left-0 aria-[current=page]:before:w-[3px] aria-[current=page]:before:rounded-sm aria-[current=page]:before:bg-nav-active aria-[current=page]:before:content-['']";

// Graphite vertical navigation rail.
export function NavigationRail({ brand, items, activeKey, onSelect, footer, label }: NavigationRailProps) {
  return (
    <nav
      className="flex w-58 flex-col gap-1 border-r border-nav-edge bg-nav-bg px-3 py-5 text-nav-text"
      aria-label={label}
    >
      <div className="flex items-center px-2 pt-1.5 pb-5.5">{brand}</div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={ITEM_CLASS}
          aria-current={item.key === activeKey ? 'page' : undefined}
          disabled={item.disabled}
          onClick={() => onSelect(item.key)}
        >
          {item.icon != null && <span aria-hidden="true" className="flex items-center gap-2.5">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
      <div className="flex-1" />
      {footer}
    </nav>
  );
}
