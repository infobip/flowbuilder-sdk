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

// ── Theme context + switch ─────────────────────────────────────────────────
//
// Owns the app's appearance: the light/dark theme and the brand. Both are
// applied as attributes on the app root (`data-flowbuilder-root`) —
// `data-theme` and `data-brand` — which switch the variables in
// styles/theme.css and styles/brands/, and both are persisted through the
// instance's storage so they survive reloads. Until the user picks a theme it
// follows the OS setting, live. The brand is reported through `onBrandChange`
// so the standalone host can pick the browser-tab icon — the builder itself
// never touches anything outside its root.
//
// The host can steer both through `useHostConfig().theme`:
// - `mode: 'light' | 'dark'` forces that theme for the session. Nothing is read
//   from or written to storage. The user's toggle (shown only when the host
//   enables `features.themeSwitch`) works within the session and is not
//   persisted. `mode: 'system'` follows the OS live and ignores storage.
// - `preset` forces the brand, likewise unstored.
// - `tokens` / `darkTokens` become `tokenStyle`, which the root applies inline.
// With no `mode` / `preset` the behaviour is the stored-or-system one above.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BrandName, ThemeName } from '../../styles/tokens';
import { useHostConfig } from '../../app/hostConfig';
import { useT } from '../../i18n/I18nProvider';
import { useInstanceStorage } from '../../app/instanceContext';
import type { InstanceStorage } from '../../services/storage';
import { resolveThemeTokenStyle, type ThemeTokenStyle } from '../../styles/themeTokens';
import { iconButtonClassName } from '../button/IconButton';
import { parseBrand } from './brand';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  brand: BrandName;
  setBrand: (brand: BrandName) => void;
  /** The host's token overrides for the active theme, as inline custom properties. */
  tokenStyle: ThemeTokenStyle;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(DARK_QUERY);
}

function readStoredTheme(storage: InstanceStorage): ThemeName | null {
  const stored = storage.read('theme');
  return stored === 'light' || stored === 'dark' ? stored : null;
}

function systemTheme(): ThemeName {
  return systemQuery()?.matches ? 'dark' : 'light';
}

export function ThemeProvider({
  children,
  onBrandChange,
}: {
  children: React.ReactNode;
  /** Called with the active brand on mount and whenever it changes. */
  onBrandChange?: (brand: BrandName) => void;
}) {
  const storage = useInstanceStorage();
  const hostTheme = useHostConfig().theme;
  const hostMode = hostTheme?.mode;
  const hostPreset = hostTheme?.preset;
  // A host-set mode or preset replaces what storage holds, and nothing is
  // persisted while it is in force.
  const hostOwnsTheme = hostMode != null;
  const hostForced: ThemeName | null = hostMode === 'light' || hostMode === 'dark' ? hostMode : null;
  const [stored] = useState(() => (hostOwnsTheme ? null : readStoredTheme(storage)));
  // Whether the user has chosen a theme. Until they do, the theme follows the OS.
  const [explicit, setExplicit] = useState(() => stored != null || hostForced != null);
  const [theme, setThemeState] = useState<ThemeName>(() => hostForced ?? stored ?? systemTheme());
  const [brand, setBrandState] = useState<BrandName>(() => hostPreset ?? parseBrand(storage.read('brand')));

  // The host can change `mode` after mount: re-seed from it.
  useEffect(() => {
    if (hostMode === 'light' || hostMode === 'dark') {
      setThemeState(hostMode);
      setExplicit(true);
    } else if (hostMode === 'system') {
      setExplicit(false);
    }
  }, [hostMode]);
  useEffect(() => {
    if (hostPreset != null) setBrandState(hostPreset);
  }, [hostPreset]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setThemeState(next);
      setExplicit(true);
      if (!hostOwnsTheme) storage.write('theme', next);
    },
    [storage, hostOwnsTheme],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeName = current === 'light' ? 'dark' : 'light';
      if (!hostOwnsTheme) storage.write('theme', next);
      return next;
    });
    setExplicit(true);
  }, [storage, hostOwnsTheme]);

  const setBrand = useCallback(
    (next: BrandName) => {
      setBrandState(next);
      if (hostPreset == null) storage.write('brand', next);
    },
    [storage, hostPreset],
  );

  // System mode: follow OS light/dark changes until the user picks a theme.
  useEffect(() => {
    if (explicit) return;
    const query = systemQuery();
    if (!query) return;
    const onChange = () => setThemeState(query.matches ? 'dark' : 'light');
    onChange();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    // Safari < 14.
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, [explicit]);

  const onBrandChangeRef = useRef(onBrandChange);
  onBrandChangeRef.current = onBrandChange;
  useEffect(() => {
    onBrandChangeRef.current?.(brand);
  }, [brand]);

  const hostTokens = hostTheme?.tokens;
  const hostDarkTokens = hostTheme?.darkTokens;
  const tokenStyle = useMemo(
    () => resolveThemeTokenStyle(theme, hostTokens, hostDarkTokens),
    [theme, hostTokens, hostDarkTokens],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, brand, setBrand, tokenStyle }),
    [theme, setTheme, toggleTheme, brand, setBrand, tokenStyle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

// A compact light/dark toggle. Renders as an accessible switch button with a
// text glyph, so it needs no icon component.
export function ThemeSwitch({ onNav = false }: { onNav?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t('common.theme.switchToLight') : t('common.theme.switchToDark')}
      title={isDark ? t('common.theme.light') : t('common.theme.dark')}
      className={iconButtonClassName({ onNav, bordered: !onNav })}
      onClick={toggleTheme}
    >
      <span aria-hidden="true" className="text-16 leading-none">{isDark ? '☾' : '☀'}</span>
    </button>
  );
}
