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

/** Hint and error text under a control; also used for inline status messages. */
export const FIELD_HINT_CLASS = 'text-12 text-subtle';
export const FIELD_ERROR_CLASS = 'text-12 font-semibold text-danger';

/**
 * The bordered text-control look shared by Input, Select's trigger and the
 * library search box. Each control adds its own height and padding;
 * `controlToneClass` adds the border and focus-ring colours.
 */
export const CONTROL_CLASS =
  'w-full rounded border bg-surface text-default transition-[border-color,box-shadow] placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

export function controlToneClass(invalid: boolean): string {
  return invalid
    ? 'border-danger focus-visible:ring-danger'
    : 'border-strong focus-visible:border-focus-ring focus-visible:ring-focus-ring';
}

// Shared label / hint / error scaffolding for form controls. Input composes
// this so its markup and a11y wiring match the rest of the form.
export type FieldShellProps = {
  id: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

export function FieldShell({ id, label, required, hint, error, className, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-13 font-semibold text-default" htmlFor={id}>
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className={FIELD_ERROR_CLASS} id={errorId} role="alert">{error}</span>
      ) : (
        hint && <span className={FIELD_HINT_CLASS} id={hintId}>{hint}</span>
      )}
    </div>
  );
}

// Resolve the aria-describedby target for a control given its hint/error state.
export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
