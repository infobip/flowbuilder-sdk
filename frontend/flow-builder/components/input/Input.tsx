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

import React, { useId } from 'react';
import { cx } from '../../utils/cx';
import { CONTROL_CLASS, FieldShell, controlToneClass, describedBy } from './Field';

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Wrapper class (the field group), not the control itself. */
  fieldClassName?: string;
};

// Single-line text input with a label / hint / error shell. 44px min height,
// strong border, high-contrast teal focus ring.
export function Input({ label, hint, error, required, fieldClassName, className, ...rest }: InputProps) {
  const autoId = useId();
  const id = rest.name ? `flowbuilder-${rest.name}` : autoId;
  const controlClass = cx(CONTROL_CLASS, controlToneClass(Boolean(error)), 'min-h-target px-3 py-2.5', className);
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} className={fieldClassName}>
      <input
        id={id}
        className={controlClass}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}
