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

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

const CARD = 'flex flex-col rounded border border-default bg-surface shadow-(--fb-shadow-card)';

// Static content surface: white/off-white in light, charcoal in dark, with a
// hairline border. Corners and shadow come from the brand (sharp and flat in
// the default look).
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={cx(CARD, className)} {...rest}>
      {children}
    </div>
  );
}

export type InteractiveCardProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

// Clickable card variant rendered as a real <button> for keyboard/focus support.
export function InteractiveCard({ className, children, type = 'button', ...rest }: InteractiveCardProps) {
  return (
    <button
      type={type}
      className={cx(
        CARD,
        'cursor-pointer text-left transition-[border-color,transform] hover:border-strong focus-visible:border-focus-ring',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={cx('px-4.5 py-4', className)} {...rest}>
      {children}
    </div>
  );
}
