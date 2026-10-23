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

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function stepActiveIndex(current: number, delta: number, length: number): number {
  return wrapIndex(current + delta, length);
}

export function indexOfValue<T extends string>(options: ReadonlyArray<SelectOption<T>>, value: T): number {
  const index = options.findIndex((option) => option.value === value);
  return index < 0 ? 0 : index;
}

export function labelForValue<T extends string>(
  options: ReadonlyArray<SelectOption<T>>,
  value: T,
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

/** Typeahead: jump to an option whose label starts with `query`. */
export function findIndexByPrefix<T extends string>(
  options: ReadonlyArray<SelectOption<T>>,
  query: string,
  fromIndex: number,
): number {
  const needle = query.trim().toLowerCase();
  if (!needle || options.length === 0) return wrapIndex(fromIndex, options.length);

  const start = wrapIndex(fromIndex, options.length);
  const from = needle.length === 1 ? start + 1 : start;
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = wrapIndex(from + offset, options.length);
    if (options[index].label.toLowerCase().startsWith(needle)) return index;
  }
  return start;
}
