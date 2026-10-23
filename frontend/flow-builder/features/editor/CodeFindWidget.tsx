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
import { useT } from '../../i18n/I18nProvider';
import { formatRich } from '../../i18n/rich';
import { cx } from '../../utils/cx';
import { isLetterKey, type ShortcutLabels } from '../../utils/keyboard';

/** A keycap in the editor's shortcut hints (tab bar and find widget). */
export const CODE_KBD_CLASS =
  'inline-flex min-w-[17px] items-center justify-center rounded border border-b-2 border-default bg-surface px-[5px] py-px font-mono text-10.5 leading-normal text-muted';

// VS Code-style find overlay: it floats over the top-right of the code instead
// of taking a row above it, and every action is a keystroke — no buttons.
export type CodeFindWidgetProps = {
  query: string;
  caseSensitive: boolean;
  matchCount: number;
  /** Zero-based index of the highlighted match, or -1 when there is none. */
  activeIndex: number;
  labels: ShortcutLabels;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onNavigate: (direction: 1 | -1) => void;
  onToggleCaseSensitive: () => void;
  onClose: () => void;
};

function SearchIcon() {
  return (
    <svg className="block flex-none text-subtle" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.2 10.2 13.5 13.5" />
    </svg>
  );
}

export function CodeFindWidget({
  query,
  caseSensitive,
  matchCount,
  activeIndex,
  labels,
  inputRef,
  onQueryChange,
  onNavigate,
  onToggleCaseSensitive,
  onClose,
}: CodeFindWidgetProps) {
  const t = useT();
  const counter = !query
    ? ''
    : matchCount === 0
      ? t('codeEditor.find.noResults')
      : t('codeEditor.find.counter', { current: String(activeIndex + 1), total: String(matchCount) });
  const hint = (key: 'next' | 'previous' | 'matchCase' | 'close', keys: React.ReactNode) =>
    formatRich(t(`codeEditor.find.hints.${key}`), { keys: <kbd className={CODE_KBD_CLASS}>{keys}</kbd> });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onNavigate(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.altKey && !event.metaKey && !event.ctrlKey && isLetterKey(event, 'c')) {
      event.preventDefault();
      onToggleCaseSensitive();
    }
  };

  return (
    <div
      className="absolute top-2.5 right-[22px] z-4 flex w-[min(340px,calc(100%-90px))] flex-col gap-[7px] rounded border border-strong bg-surface-raised px-2.5 py-2 shadow-popover compact:w-[min(340px,calc(100%-44px))] narrow:w-[calc(100%-44px)]"
      role="search"
      aria-label={t('codeEditor.find.label')}
    >
      <div className="flex items-center gap-2">
        <SearchIcon />
        <input
          ref={inputRef}
          className="h-7 min-w-0 flex-auto rounded-sm border border-default bg-surface px-[7px] font-mono text-12 leading-[normal] text-default placeholder:text-subtle focus-visible:border-focus-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
          type="text"
          value={query}
          placeholder={t('codeEditor.find.placeholder')}
          aria-label={t('codeEditor.find.inputLabel')}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span
          className={cx(
            'flex-none rounded-sm border px-1.5 py-0.5 text-11 font-bold',
            caseSensitive ? 'border-accent bg-accent-soft text-accent' : 'border-default text-subtle',
          )}
          aria-label={t(caseSensitive ? 'codeEditor.find.matchCaseOn' : 'codeEditor.find.matchCaseOff')}
        >
          Aa
        </span>
        <span
          className={cx(
            'min-w-14 flex-none text-right text-11 font-semibold tabular-nums',
            query && matchCount === 0 ? 'text-danger' : 'text-subtle',
          )}
          aria-live="polite"
        >
          {counter}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-11 text-subtle">
        <span>{hint('next', labels.enter)}</span>
        <span>{hint('previous', <>{labels.shift}{labels.enter}</>)}</span>
        <span>{hint('matchCase', <>{labels.alt}C</>)}</span>
        <span>{hint('close', 'Esc')}</span>
      </div>
    </div>
  );
}
