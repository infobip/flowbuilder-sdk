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

// ── Flow Builder editor top bar ────────────────────────────────────────────
//
// Compact bar above the editor body: a "← Flow library" back link, an inline
// editable flow title with a Draft/Saved badge, and the "Fix errors" action.
// Purely presentational — all state comes from the editor page via props.
//
// Theme is deliberately not offered here. The navigation rail owns the single
// theme control for the whole app.

import React, { useEffect, useRef, useState } from 'react';
import { Badge, type BadgeTone } from '../../components/badge/Badge';
import { Button } from '../../components/button/Button';
import { useNavigate } from '../../app/instanceContext';
import { useT } from '../../i18n/I18nProvider';
import { useElementHeight } from '../../utils/useElementHeight';

/** The "← Flow library" link, shared with the published-flow preview page. */
export const BACK_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded px-2.5 py-2 font-semibold text-muted cursor-pointer transition-[color,background-color,border-color] hover:bg-surface-sunken hover:text-default';

export type EditorTopBarProps = {
  title: string;
  onTitleChange: (value: string) => void;
  statusLabel: string;
  statusTone: BadgeTone;
  canFixErrors: boolean;
  fixBusy: boolean;
  errorCount: number;
  onFixErrors: () => void;
  /** Reports the bar's rendered height, so content below can stick beneath it. */
  onHeightChange?: (height: number) => void;
};

export function EditorTopBar({
  title,
  onTitleChange,
  statusLabel,
  statusTone,
  canFixErrors,
  fixBusy,
  errorCount,
  onFixErrors,
  onHeightChange,
}: EditorTopBarProps) {
  const navigate = useNavigate();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const height = useElementHeight(headerRef);

  useEffect(() => {
    if (height != null) onHeightChange?.(height);
  }, [height, onHeightChange]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const displayTitle = title.trim() || t('editor.untitledFlow');

  return (
    <header ref={headerRef} className="sticky top-0 z-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-default bg-surface px-6 py-3 narrow:grid-cols-[1fr] narrow:gap-2.5 narrow:px-4">
      <div className="justify-self-start narrow:justify-self-stretch">
        <button type="button" className={BACK_BUTTON_CLASS} onClick={() => navigate({ name: 'library' })}>
          <span aria-hidden="true">←</span> {t('editor.topBar.backToLibrary')}
        </button>
      </div>

      <div className="flex min-w-0 items-center gap-2.5 justify-self-center narrow:justify-self-stretch narrow:justify-start">
        {editing ? (
          <input
            ref={inputRef}
            className="min-w-60 max-w-85 rounded border border-focus-ring bg-surface px-2.5 py-1.5 text-15 font-semibold text-default placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
            }}
            placeholder={t('editor.untitledFlow')}
            aria-label={t('editor.topBar.titleLabel')}
          />
        ) : (
          <button
            type="button"
            className="inline-flex max-w-85 items-center gap-2 rounded border border-transparent px-2.5 py-1.5 text-15 font-semibold text-default cursor-text transition-[background-color,border-color] hover:border-default hover:bg-surface-sunken"
            onClick={() => setEditing(true)}
            title={t('editor.topBar.rename')}
          >
            <span className="truncate">{displayTitle}</span>
            <span className="text-12 opacity-60" aria-hidden="true">✏️</span>
          </button>
        )}
        <Badge tone={statusTone} dot>{statusLabel}</Badge>
      </div>

      <div className="flex items-center gap-3 justify-self-end narrow:justify-self-stretch narrow:justify-between">
        <Button
          variant="secondary"
          onClick={onFixErrors}
          disabled={!canFixErrors}
          startSlot={<span aria-hidden="true">⚠</span>}
        >
          {fixBusy ? t('editor.topBar.fixing') : errorCount > 0 ? t('editor.topBar.fixErrorsCount', { count: String(errorCount) }) : t('editor.topBar.fixErrors')}
        </Button>
      </div>
    </header>
  );
}
