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

// Pure helpers for getting the compiled stylesheet into a shadow root.

/**
 * Tailwind registers its internal `--tw-*` variables with `@property` so they
 * have initial values (`--tw-shadow`, `--tw-ring-offset-width`, ...). `@property` is ignored inside a shadow tree, so a `box-shadow` or
 * `ring` utility that reads one it didn't set would be invalid and drop the
 * whole declaration. This re-declares those initial values on the builder's
 * elements instead, with zero specificity so any utility still wins. The
 * registrations are `inherits: false`, which `*` reproduces.
 */
export function propertyFallbackCss(css: string): string {
  const declarations: string[] = [];
  for (const match of css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    const initial = /initial-value\s*:\s*([^;}]+)/.exec(match[2]);
    if (initial) declarations.push(`${match[1]}:${initial[1].trim()}`);
  }
  if (declarations.length === 0) return '';
  const target = ':where([data-flowbuilder-root],[data-flowbuilder-root] *,[data-flowbuilder-root] ::before,[data-flowbuilder-root] ::after,[data-flowbuilder-root] ::backdrop)';
  return `${target}{${declarations.join(';')}}`;
}

/** The `@font-face` rules, which only take effect in the document, never in a shadow root. */
export function extractFontFaces(css: string): string {
  return (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).join('\n');
}

/** Sizing for the host element itself, so `layout="fill"` has a box to fill. */
export const HOST_CSS = ':host{display:block;height:100%}:host([layout="page"]){height:auto}:host([hidden]){display:none}';

/** The full sheet a shadow root adopts. */
export function buildShadowCss(css: string): string {
  return [propertyFallbackCss(css), css, HOST_CSS].filter(Boolean).join('\n');
}
