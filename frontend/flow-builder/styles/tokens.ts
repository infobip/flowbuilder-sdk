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

// ── Flow Builder tokens that TypeScript needs ──────────────────────────────
//
// Colours, fonts, radii and the button palette live in `theme.css` — that file
// is the only place to rebrand. What stays here is the part code has to read.

export type ThemeName = 'light' | 'dark';

/** The looks the app can wear. `default` is theme.css alone; each other brand
 *  layers `styles/brands/<name>.css` over it. */
export const BRANDS = ['default', 'indigo'] as const;
export type BrandName = (typeof BRANDS)[number];

// Editor metrics live in TS because the gutter, the highlight layer and the
// scroll/reveal maths all have to agree on the exact row height. The editor
// hands them to its stylesheet as inline `--code-*` custom properties.
export const CODE_METRICS = {
  fontSize: 12.5,
  lineHeight: 20,
  tabSize: 2,
  paddingTop: 12,
  paddingBottom: 28,
  paddingLeft: 12,
  paddingRight: 24,
  gutterWidth: 52,
} as const;

// ── Button colour parameters ───────────────────────────────────────────────
//
// Each variant takes its colours from its own `--color-btn-<variant>-<slot>`
// tokens in theme.css rather than from the semantic ramp, so buttons can be
// retinted without dragging badges, links and focus rings along.

/** Also the source of `ButtonVariant` — a new variant must bring a palette entry. */
export const BUTTON_VARIANTS = ['primary', 'accent', 'secondary', 'ghost', 'danger'] as const;
export type ButtonVariantName = (typeof BUTTON_VARIANTS)[number];

/** The colour slots every variant fills. `bg-active` is the pressed background. */
export const BUTTON_SLOTS = ['bg', 'bg-hover', 'bg-active', 'text', 'border'] as const;
