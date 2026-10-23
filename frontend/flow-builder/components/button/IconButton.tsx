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

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required for accessibility — icon buttons have no visible text label. */
  label: string;
  /** Draw a strong border (default is a borderless ghost look). */
  bordered?: boolean;
  /** Style for placement on the graphite navigation rail. */
  onNav?: boolean;
};

/** The icon-button look, shared with buttons that need their own markup (the theme switch). */
export function iconButtonClassName({ bordered = false, onNav = false }: { bordered?: boolean; onNav?: boolean }): string {
  return cx(
    // `font: revert` keeps the browser's own button font: the icons are text
    // glyphs (☀ ☾ × ★), and the app font's fallbacks draw some of them differently.
    'inline-flex size-target items-center justify-center rounded border bg-transparent [font:revert] cursor-pointer transition-[color,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50',
    bordered ? 'border-strong' : 'border-transparent',
    onNav
      ? 'text-nav-text-muted hover:bg-nav-hover hover:text-nav-text'
      : 'text-muted hover:bg-surface-sunken hover:text-default',
  );
}

// A square, icon-only action. Always 44×44px to meet the minimum target size,
// and always carries an accessible name via `aria-label`.
export function IconButton({
  label,
  bordered = false,
  onNav = false,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(iconButtonClassName({ bordered, onNav }), className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <span aria-hidden="true" className="flex items-center gap-2.5">{children}</span>
    </button>
  );
}
