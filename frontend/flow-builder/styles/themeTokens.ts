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

// ── Public theme tokens ────────────────────────────────────────────────────
//
// The typed map a host passes as `theme.tokens` / `theme.darkTokens`. Each
// camelCase key stands for one `--fb-*` custom property declared in theme.css
// (`colorSurface` → `--fb-color-surface`). The list is hand-written and kept
// honest by styles/theme.test.ts, which fails when theme.css and this file
// disagree in either direction.

export const THEME_TOKEN_VARS = {
  borderColorDefault: '--fb-border-color-default',
  borderColorStrong: '--fb-border-color-strong',
  colorAccent: '--fb-color-accent',
  colorAccentSoft: '--fb-color-accent-soft',
  colorBtnAccentBg: '--fb-color-btn-accent-bg',
  colorBtnAccentBgActive: '--fb-color-btn-accent-bg-active',
  colorBtnAccentBgHover: '--fb-color-btn-accent-bg-hover',
  colorBtnAccentBorder: '--fb-color-btn-accent-border',
  colorBtnAccentText: '--fb-color-btn-accent-text',
  colorBtnDangerBg: '--fb-color-btn-danger-bg',
  colorBtnDangerBgActive: '--fb-color-btn-danger-bg-active',
  colorBtnDangerBgHover: '--fb-color-btn-danger-bg-hover',
  colorBtnDangerBorder: '--fb-color-btn-danger-border',
  colorBtnDangerText: '--fb-color-btn-danger-text',
  colorBtnGhostBg: '--fb-color-btn-ghost-bg',
  colorBtnGhostBgActive: '--fb-color-btn-ghost-bg-active',
  colorBtnGhostBgHover: '--fb-color-btn-ghost-bg-hover',
  colorBtnGhostBorder: '--fb-color-btn-ghost-border',
  colorBtnGhostText: '--fb-color-btn-ghost-text',
  colorBtnPrimaryBg: '--fb-color-btn-primary-bg',
  colorBtnPrimaryBgActive: '--fb-color-btn-primary-bg-active',
  colorBtnPrimaryBgHover: '--fb-color-btn-primary-bg-hover',
  colorBtnPrimaryBorder: '--fb-color-btn-primary-border',
  colorBtnPrimaryText: '--fb-color-btn-primary-text',
  colorBtnSecondaryBg: '--fb-color-btn-secondary-bg',
  colorBtnSecondaryBgActive: '--fb-color-btn-secondary-bg-active',
  colorBtnSecondaryBgHover: '--fb-color-btn-secondary-bg-hover',
  colorBtnSecondaryBorder: '--fb-color-btn-secondary-border',
  colorBtnSecondaryText: '--fb-color-btn-secondary-text',
  colorCanvas: '--fb-color-canvas',
  colorCodeBg: '--fb-color-code-bg',
  colorCodeChrome: '--fb-color-code-chrome',
  colorCodeGutterActive: '--fb-color-code-gutter-active',
  colorCodeGutterText: '--fb-color-code-gutter-text',
  colorCodeKey: '--fb-color-code-key',
  colorCodeLineActive: '--fb-color-code-line-active',
  colorCodeLiteral: '--fb-color-code-literal',
  colorCodeMatch: '--fb-color-code-match',
  colorCodeMatchActive: '--fb-color-code-match-active',
  colorCodeNumber: '--fb-color-code-number',
  colorCodePunctuation: '--fb-color-code-punctuation',
  colorCodeSelection: '--fb-color-code-selection',
  colorCodeString: '--fb-color-code-string',
  colorDanger: '--fb-color-danger',
  colorDangerSoft: '--fb-color-danger-soft',
  colorFocusRing: '--fb-color-focus-ring',
  colorNavActive: '--fb-color-nav-active',
  colorNavBg: '--fb-color-nav-bg',
  colorNavEdge: '--fb-color-nav-edge',
  colorNavHover: '--fb-color-nav-hover',
  colorNavSurface: '--fb-color-nav-surface',
  colorNavText: '--fb-color-nav-text',
  colorNavTextMuted: '--fb-color-nav-text-muted',
  colorOnPrimary: '--fb-color-on-primary',
  colorOverlay: '--fb-color-overlay',
  colorPreviewBackdrop: '--fb-color-preview-backdrop',
  colorPrimary: '--fb-color-primary',
  colorPrimarySoft: '--fb-color-primary-soft',
  colorSuccess: '--fb-color-success',
  colorSuccessSoft: '--fb-color-success-soft',
  colorSurface: '--fb-color-surface',
  colorSurfaceRaised: '--fb-color-surface-raised',
  colorSurfaceSunken: '--fb-color-surface-sunken',
  colorWarning: '--fb-color-warning',
  colorWarningSoft: '--fb-color-warning-soft',
  defaultTransitionDuration: '--fb-default-transition-duration',
  defaultTransitionTimingFunction: '--fb-default-transition-timing-function',
  fontMono: '--fb-font-mono',
  fontSans: '--fb-font-sans',
  radius: '--fb-radius',
  radiusBubble: '--fb-radius-bubble',
  radiusLg: '--fb-radius-lg',
  radiusMd: '--fb-radius-md',
  radiusSm: '--fb-radius-sm',
  radiusXl: '--fb-radius-xl',
  shadowCard: '--fb-shadow-card',
  shadowPopover: '--fb-shadow-popover',
  textColorDefault: '--fb-text-color-default',
  textColorMuted: '--fb-text-color-muted',
  textColorSubtle: '--fb-text-color-subtle',
} as const;

export type ThemeTokenKey = keyof typeof THEME_TOKEN_VARS;
export type FlowBuilderThemeTokens = Partial<Record<ThemeTokenKey, string>>;

/** A CSS custom-property map, ready for a React `style` prop. */
export type ThemeTokenStyle = Record<string, string>;

// A value may only be a property value. Anything that could end the
// declaration or open a rule (`;` `{` `}`), markup (`<` `>`), a comment, or a
// request (`url(`) is dropped, so a host-supplied token can't smuggle in other
// declarations or load resources. The value is also applied through React's
// `style` (CSSOM), never serialised into a stylesheet.
const UNSAFE_VALUE = /[;{}<>]|\/\*|url\s*\(/i;

function isSafeValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !UNSAFE_VALUE.test(value);
}

const KNOWN_KEYS = new Set<string>(Object.keys(THEME_TOKEN_VARS));

/** Custom properties for the known keys with safe string values; the rest are ignored. */
export function themeTokensToStyle(tokens: FlowBuilderThemeTokens | undefined): ThemeTokenStyle {
  const style: ThemeTokenStyle = {};
  if (!tokens || typeof tokens !== 'object') return style;
  for (const [key, value] of Object.entries(tokens)) {
    if (!KNOWN_KEYS.has(key) || !isSafeValue(value)) continue;
    style[THEME_TOKEN_VARS[key as ThemeTokenKey]] = value.trim();
  }
  return style;
}

// Colours, and the shadows that are drawn in them, differ per theme. Fonts,
// radii and motion are the same in both.
const THEME_SPECIFIC = /^(color|textColor|borderColor|shadow)/;

/**
 * The inline token style for the active theme.
 *
 * Inline custom properties beat both theme.css blocks, so a light colour in
 * `tokens` would otherwise paint dark mode too. Hence:
 * - light: `tokens`;
 * - dark: `darkTokens`, plus the theme-independent `tokens` (fonts, radii,
 *   motion) beneath them. A colour in `tokens` never reaches dark mode; dark
 *   colours come from `darkTokens` or the built-in dark theme.
 */
export function resolveThemeTokenStyle(
  theme: 'light' | 'dark',
  tokens: FlowBuilderThemeTokens | undefined,
  darkTokens: FlowBuilderThemeTokens | undefined,
): ThemeTokenStyle {
  if (theme === 'light') return themeTokensToStyle(tokens);
  const shared: FlowBuilderThemeTokens = {};
  for (const [key, value] of Object.entries(tokens ?? {})) {
    if (!THEME_SPECIFIC.test(key)) (shared as Record<string, unknown>)[key] = value;
  }
  return { ...themeTokensToStyle(shared), ...themeTokensToStyle(darkTokens) };
}
