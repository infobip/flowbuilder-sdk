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

// ── Keyboard shortcut helpers ──────────────────────────────────────────────
//
// The code editor is keyboard-driven, so it needs two things: labels that match
// the user's platform, and letter matching that survives macOS mangling `Alt`
// combinations (Alt+F reports `key: "ƒ"`, but `code: "KeyF"`).

export type KeyboardPlatform = 'apple' | 'other';

export type ShortcutLabels = {
  mod: string;
  alt: string;
  shift: string;
  enter: string;
};

export function detectKeyboardPlatform(source?: { platform?: string; userAgent?: string }): KeyboardPlatform {
  const hint = `${source?.platform ?? ''} ${source?.userAgent ?? ''}`;
  return /mac|iphone|ipad|ipod/i.test(hint) ? 'apple' : 'other';
}

export function shortcutLabels(platform: KeyboardPlatform): ShortcutLabels {
  return platform === 'apple'
    ? { mod: '⌘', alt: '⌥', shift: '⇧', enter: '↵' }
    : { mod: 'Ctrl+', alt: 'Alt+', shift: 'Shift+', enter: 'Enter' };
}

/** Match a letter key by physical code first, then by the produced character. */
export function isLetterKey(event: { key?: string; code?: string }, letter: string): boolean {
  const target = letter.toLowerCase();
  if (event.code === `Key${target.toUpperCase()}`) return true;
  return (event.key ?? '').toLowerCase() === target;
}
