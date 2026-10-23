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

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'danger' | 'warning';

export type BadgeProps = {
  tone?: BadgeTone;
  /** Show a leading status dot. */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-default bg-surface-sunken text-muted',
  primary: 'border-transparent bg-primary-soft text-primary',
  accent: 'border-transparent bg-accent-soft text-accent',
  success: 'border-transparent bg-success-soft text-success',
  danger: 'border-transparent bg-danger-soft text-danger',
  warning: 'border-transparent bg-warning-soft text-warning',
};

// Small status / category label. Tones map to the token palette.
export function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm border px-[9px] py-[3px] text-11 font-bold uppercase leading-[1.4] tracking-[0.3px]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
