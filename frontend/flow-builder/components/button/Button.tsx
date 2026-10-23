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
import type { ButtonVariantName } from '../../styles/tokens';
import { cx } from '../../utils/cx';

// Tied to the button color table so a variant can never render without one.
export type ButtonVariant = ButtonVariantName;
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Optional leading glyph/icon node rendered before the label. */
  startSlot?: React.ReactNode;
  /** Optional trailing glyph/icon node rendered after the label. */
  endSlot?: React.ReactNode;
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded border font-medium leading-none whitespace-nowrap cursor-pointer transition-[color,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-target px-4.5',
  sm: 'min-h-9 px-3 text-13',
};

// Every colour comes from the variant's own tokens in theme.css
// (`--color-btn-<variant>-<slot>`), never from the semantic ramp, so a button
// can be retinted there without dragging badges and links along.
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'border-btn-primary-border bg-btn-primary-bg text-btn-primary-text enabled:hover:bg-btn-primary-bg-hover enabled:active:bg-btn-primary-bg-active',
  accent:
    'border-btn-accent-border bg-btn-accent-bg text-btn-accent-text enabled:hover:bg-btn-accent-bg-hover enabled:active:bg-btn-accent-bg-active',
  secondary:
    'border-btn-secondary-border bg-btn-secondary-bg text-btn-secondary-text enabled:hover:bg-btn-secondary-bg-hover enabled:active:bg-btn-secondary-bg-active',
  ghost:
    'border-btn-ghost-border bg-btn-ghost-bg text-btn-ghost-text enabled:hover:bg-btn-ghost-bg-hover enabled:active:bg-btn-ghost-bg-active',
  danger:
    'border-btn-danger-border bg-btn-danger-bg text-btn-danger-text enabled:hover:bg-btn-danger-bg-hover enabled:active:bg-btn-danger-bg-active',
};

// Button primitive. Deep-teal primary by default, sharp corners, >=44px tall
// (or 36px in the `sm` size for dense toolbars). `className` is for placement
// (width, alignment, margins): size and colour come from `size` and `variant`.
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  startSlot,
  endSlot,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = cx(BASE, SIZE_CLASSES[size], BUTTON_VARIANT_CLASSES[variant], block && 'w-full', className);

  return (
    <button type={type} className={classes} {...rest}>
      {startSlot != null && <span aria-hidden="true" className="flex items-center gap-2.5">{startSlot}</span>}
      {children}
      {endSlot != null && <span aria-hidden="true" className="flex items-center gap-2.5">{endSlot}</span>}
    </button>
  );
}
