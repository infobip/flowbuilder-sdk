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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/button/Button';
import { CODE_KBD_CLASS, CodeFindWidget } from './CodeFindWidget';
import { useT } from '../../i18n/I18nProvider';
import { formatRich } from '../../i18n/rich';
import { describeValidationIssue } from '../../i18n/validation';
import { CODE_METRICS } from '../../styles/tokens';
import { cx } from '../../utils/cx';
import {
  applyTextEdit,
  autoPairEdit,
  CODE_INDENT,
  diffEdit,
  indentEdit,
  isCaretMove,
  newlineEdit,
  outdentEdit,
  pairDeleteEdit,
  type TextEdit,
} from '../../utils/codeEditor';
import {
  findJsonMatches,
  formatJsonDraft,
  getJsonLineCount,
  getJsonLineRange,
  indexToLineColumn,
  type JsonEditorValidationIssue,
  type TextRange,
} from '../../utils/jsonEditor';
import { buildHighlightedLines, type HighlightSegment } from '../../utils/jsonHighlight';
import { detectKeyboardPlatform, isLetterKey, shortcutLabels } from '../../utils/keyboard';

export type JsonCodeEditorProps = {
  value: string;
  error: string | null;
  issues: JsonEditorValidationIssue[];
  onChange: (value: string) => void;
  /** Persist the draft (⌘S / the one visible button). */
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  disabled?: boolean;
  focusLine?: number | null;
  focusRequestId?: number;
  className?: string;
};

const M = CODE_METRICS;
/** Past this size the tokenizer is skipped and the draft renders unstyled. */
const MAX_HIGHLIGHT_CHARS = 200_000;
const RULER_SAMPLE = '0'.repeat(40);
const NOTICE_MS = 2400;

/** The metrics the highlight layer and the textarea share (consumed by `.code-text` / `.code-input`). */
const CODE_METRIC_VARS = {
  '--code-font-size': `${M.fontSize}px`,
  '--code-line-height': `${M.lineHeight}px`,
  '--code-tab-size': M.tabSize,
  '--code-pad-top': `${M.paddingTop}px`,
  '--code-pad-right': `${M.paddingRight}px`,
  '--code-pad-bottom': `${M.paddingBottom}px`,
  '--code-pad-left': `${M.paddingLeft}px`,
  '--code-gutter-width': `${M.gutterWidth}px`,
} as React.CSSProperties;

const TOKEN_CLASSES: Record<HighlightSegment['type'], string> = {
  key: 'text-code-key',
  string: 'text-code-string',
  number: 'text-code-number',
  literal: 'font-semibold text-code-literal',
  punctuation: 'text-code-punctuation',
  plain: 'text-muted',
};

const HIT_CLASSES: Record<HighlightSegment['match'], string> = {
  none: '',
  match: 'rounded-sm bg-code-match',
  active: 'rounded-sm bg-code-match-active shadow-[0_0_0_1px_var(--fb-color-accent)]',
};

const GUTTER_ISSUE_CLASS =
  "text-danger before:absolute before:top-1/2 before:left-[7px] before:-mt-[3px] before:size-1.5 before:rounded-full before:bg-danger before:content-['']";

const STATUS_TONE_CLASSES = {
  error: 'font-semibold text-danger',
  warning: 'font-semibold text-warning',
  ok: 'font-semibold text-success',
} as const;

const STATUS_ITEM_CLASS = 'inline-flex items-center gap-1.5 tabular-nums';

function CodeFileIcon() {
  return (
    <svg className="block text-code-key" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.1 2.6c-1.4 0-1.8.7-1.8 1.8v1.7c0 1-.6 1.6-1.6 1.9 1 .3 1.6.9 1.6 1.9v1.7c0 1.1.4 1.8 1.8 1.8" />
      <path d="M9.9 2.6c1.4 0 1.8.7 1.8 1.8v1.7c0 1 .6 1.6 1.6 1.9-1 .3-1.6.9-1.6 1.9v1.7c0 1.1-.4 1.8-1.8 1.8" />
    </svg>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 8.4 3.1 3.1L13 4.6" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5.4" y="5.4" width="8.1" height="8.1" rx="1.6" />
      <path d="M10.6 5.4V4a1.6 1.6 0 0 0-1.6-1.6H4a1.6 1.6 0 0 0-1.6 1.6v5a1.6 1.6 0 0 0 1.6 1.6h1.4" />
    </svg>
  );
}

function segmentClassName(segment: HighlightSegment): string {
  return cx(TOKEN_CLASSES[segment.type], HIT_CLASSES[segment.match]);
}

export function JsonCodeEditor({
  value,
  error,
  issues,
  onChange,
  onSave,
  canSave,
  saving,
  disabled,
  focusLine,
  focusRequestId,
  className,
}: JsonCodeEditorProps) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const bandsRef = useRef<HTMLDivElement | null>(null);
  const linesRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLSpanElement | null>(null);
  // Selection to restore after a non-execCommand edit round-trips through React.
  const pendingSelection = useRef<TextRange | null>(null);
  // Escape arms one Tab press to move focus instead of indenting (a11y escape hatch).
  const tabMovesFocus = useRef(false);
  const charWidth = useRef(7.5);

  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatch, setActiveMatch] = useState(0);
  const [caret, setCaret] = useState({ line: 1, column: 1, selected: 0 });
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const labels = useMemo(
    () => shortcutLabels(detectKeyboardPlatform(typeof navigator === 'undefined' ? undefined : navigator)),
    [],
  );

  const matches = useMemo(
    () => (findOpen ? findJsonMatches(value, query, { caseSensitive }) : []),
    [findOpen, value, query, caseSensitive],
  );
  const activeIndex = matches.length === 0 ? -1 : Math.min(activeMatch, matches.length - 1);
  const lineCount = useMemo(() => getJsonLineCount(value), [value]);
  const issueLines = useMemo(
    () => new Set(issues.map((issue) => issue.line).filter((line): line is number => line != null)),
    [issues],
  );

  const lines = useMemo<HighlightSegment[][]>(() => {
    if (value.length > MAX_HIGHLIGHT_CHARS) {
      return value.split(/\r\n|\r|\n/).map((text) => [{ text, type: 'plain', match: 'none' }]);
    }
    return buildHighlightedLines(value, matches, activeIndex);
  }, [value, matches, activeIndex]);

  const lineElements = useMemo(
    () =>
      lines.map((segments, index) => (
        <div key={index} className="fb-code-text h-(--code-line-height) whitespace-pre text-default">
          {segments.map((segment, segmentIndex) => (
            <span key={segmentIndex} className={segmentClassName(segment)}>
              {segment.text}
            </span>
          ))}
        </div>
      )),
    [lines],
  );

  const gutterRows = useMemo(
    () =>
      Array.from({ length: lineCount }, (_, index) => {
        const line = index + 1;
        const tone = issueLines.has(line)
          ? GUTTER_ISSUE_CLASS
          : line === caret.line
            ? 'text-code-gutter-active'
            : 'text-code-gutter-text';
        return (
          <div key={line} className={cx('fb-code-text relative h-(--code-line-height) pr-3.5 text-right tabular-nums', tone)}>
            {line}
          </div>
        );
      }),
    [lineCount, caret.line, issueLines],
  );

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { scrollLeft, scrollTop } = textarea;
    if (linesRef.current) linesRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    if (bandsRef.current) bandsRef.current.style.transform = `translateY(${-scrollTop}px)`;
    if (gutterRef.current) gutterRef.current.style.transform = `translateY(${-scrollTop}px)`;
  }, []);

  const syncCaret = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { line, column } = indexToLineColumn(textarea.value, textarea.selectionStart);
    setCaret({ line, column: column + 1, selected: textarea.selectionEnd - textarea.selectionStart });
  }, []);

  const revealRange = useCallback(
    (start: number, end: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const from = indexToLineColumn(textarea.value, start);
      const to = indexToLineColumn(textarea.value, end);

      const top = (from.line - 1) * M.lineHeight;
      const viewHeight = Math.max(M.lineHeight, textarea.clientHeight - M.paddingTop);
      if (top < textarea.scrollTop) textarea.scrollTop = Math.max(0, top - M.lineHeight * 2);
      else if (top + M.lineHeight > textarea.scrollTop + viewHeight) {
        textarea.scrollTop = top + M.lineHeight * 3 - viewHeight;
      }

      const left = from.column * charWidth.current;
      const right = to.line === from.line ? to.column * charWidth.current : left;
      const viewWidth = Math.max(80, textarea.clientWidth - M.paddingLeft - M.paddingRight);
      if (left < textarea.scrollLeft) textarea.scrollLeft = Math.max(0, left - 60);
      else if (right > textarea.scrollLeft + viewWidth) textarea.scrollLeft = right - viewWidth + 60;

      syncScroll();
    },
    [syncScroll],
  );

  const flashNotice = useCallback((message: string) => setNotice(message), []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  useLayoutEffect(() => {
    const ruler = rulerRef.current;
    if (!ruler) return;
    const width = ruler.getBoundingClientRect().width / RULER_SAMPLE.length;
    if (width > 0) charWidth.current = width;
  }, []);

  // Content height changes can clamp scrollTop, so re-align the layers after
  // every render that changed the document.
  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    pendingSelection.current = null;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(pending.start, pending.end);
    syncCaret();
  }, [value, syncCaret]);

  const applyEdit = useCallback(
    (edit: TextEdit) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (isCaretMove(edit)) {
        textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        syncCaret();
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(edit.rangeStart, edit.rangeEnd);

      // execCommand is deprecated but it is still the only way to edit a
      // textarea without throwing away the browser's undo history.
      let applied = false;
      try {
        applied = edit.text === ''
          ? document.execCommand('delete')
          : document.execCommand('insertText', false, edit.text);
      } catch {
        applied = false;
      }

      if (applied) {
        textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
        syncCaret();
        return;
      }

      const next = applyTextEdit(textarea.value, edit);
      pendingSelection.current = { start: next.selectionStart, end: next.selectionEnd };
      onChange(next.value);
    },
    [onChange, syncCaret],
  );

  const goToLine = useCallback(
    (line: number) => {
      const textarea = textareaRef.current;
      const range = getJsonLineRange(value, line);
      if (!textarea || !range) return;
      textarea.focus();
      textarea.setSelectionRange(range.start, range.end);
      revealRange(range.start, range.end);
      syncCaret();
    },
    [value, revealRange, syncCaret],
  );

  useEffect(() => {
    if (focusLine != null) goToLine(focusLine);
    // `focusRequestId` re-triggers a jump to the same line.
  }, [focusLine, focusRequestId]);

  const formatDocument = useCallback(() => {
    const formatted = formatJsonDraft(value, t);
    if (formatted.value == null) {
      flashNotice(t('codeEditor.notices.cannotFormat'));
      return;
    }
    const edit = diffEdit(value, formatted.value);
    if (!edit) {
      flashNotice(t('codeEditor.notices.alreadyFormatted'));
      return;
    }
    applyEdit(edit);
    flashNotice(t('codeEditor.notices.formatted'));
  }, [value, applyEdit, flashNotice, t]);

  const copyAll = useCallback(async () => {
    const text = textareaRef.current?.value ?? value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return;
    } catch {
      // Clipboard API is unavailable (older browser / insecure origin).
    }
    const textarea = textareaRef.current;
    if (textarea && !textarea.disabled) {
      const selection = { start: textarea.selectionStart, end: textarea.selectionEnd };
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      textarea.setSelectionRange(selection.start, selection.end);
      if (ok) {
        setCopied(true);
        return;
      }
    }
    flashNotice(t('codeEditor.notices.copyBlocked', { mod: labels.mod }));
  }, [value, labels.mod, flashNotice, t]);

  const openFind = useCallback(() => {
    const textarea = textareaRef.current;
    const selected = textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : '';
    if (selected && !selected.includes('\n')) setQuery(selected);
    setFindOpen(true);
    window.requestAnimationFrame(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    });
  }, []);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    textareaRef.current?.focus();
  }, []);

  const navigateMatch = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0 || activeIndex < 0) return;
      const next = (activeIndex + direction + matches.length) % matches.length;
      setActiveMatch(next);
      const match = matches[next];
      textareaRef.current?.setSelectionRange(match.start, match.end);
      revealRange(match.start, match.end);
    },
    [matches, activeIndex, revealRange],
  );

  // A new query jumps to the first hit at or after the caret, like VS Code.
  // Deliberately keyed on the query only: editing the document must not yank
  // the viewport back to a match while the find widget is open.
  useEffect(() => {
    if (!findOpen) return;
    if (matches.length === 0) {
      setActiveMatch(0);
      return;
    }
    const from = textareaRef.current?.selectionStart ?? 0;
    const found = matches.findIndex((match) => match.start >= from);
    const index = found < 0 ? 0 : found;
    setActiveMatch(index);
    revealRange(matches[index].start, matches[index].end);
  }, [query, caseSensitive, findOpen]);

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea || event.nativeEvent.isComposing) return;
    const state = {
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    };

    if (event.key === 'Escape') {
      if (findOpen) return;
      tabMovesFocus.current = true;
      flashNotice(t('codeEditor.notices.tabMovesFocus'));
      return;
    }

    if (event.key === 'Tab') {
      if (tabMovesFocus.current) {
        tabMovesFocus.current = false;
        return;
      }
      event.preventDefault();
      const edit = event.shiftKey ? outdentEdit(state) : indentEdit(state);
      if (edit) applyEdit(edit);
      return;
    }

    tabMovesFocus.current = false;

    // Leave modified keys to the shell shortcuts and native editing commands.
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      applyEdit(newlineEdit(state));
      return;
    }

    if (event.key === 'Backspace') {
      const edit = pairDeleteEdit(state);
      if (edit) {
        event.preventDefault();
        applyEdit(edit);
      }
      return;
    }

    if (event.key.length === 1) {
      const edit = autoPairEdit(state, event.key);
      if (edit) {
        event.preventDefault();
        applyEdit(edit);
      }
    }
  };

  const handleShellKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    const mod = event.metaKey || event.ctrlKey;

    if (mod && !event.altKey && !event.shiftKey && isLetterKey(event, 'f')) {
      event.preventDefault();
      openFind();
      return;
    }
    if (mod && isLetterKey(event, 's')) {
      event.preventDefault();
      if (canSave && !disabled) onSave();
      return;
    }
    if (event.altKey && event.shiftKey && !mod && isLetterKey(event, 'f')) {
      event.preventDefault();
      if (!disabled) formatDocument();
      return;
    }
    if (event.key === 'F3' || (mod && isLetterKey(event, 'g'))) {
      event.preventDefault();
      if (findOpen) navigateMatch(event.shiftKey ? -1 : 1);
      else openFind();
      return;
    }
    if (event.key === 'Escape' && findOpen) {
      event.preventDefault();
      closeFind();
    }
  };

  const problemLabel = error
    ? error
    : issues.length > 0
      ? issues[0]
        ? t('codeEditor.status.issues', { count: issues.length, message: describeValidationIssue(t, issues[0], t('editor.validation.unknownIssue')) })
        : t('editor.validation.count', { count: issues.length })
      : t('codeEditor.status.noProblems');
  const problemTone = error ? 'error' : issues.length > 0 ? 'warning' : 'ok';

  return (
    <section
      className={cx(
        'flex min-w-0 flex-col overflow-hidden rounded border bg-code-bg focus-within:border-focus-ring',
        error ? 'border-danger' : 'border-default',
        className,
      )}
      style={CODE_METRIC_VARS}
      aria-label={t('codeEditor.label')}
      onKeyDown={handleShellKeyDown}
    >
      <div className="flex items-stretch justify-between gap-3 border-b border-default bg-code-chrome pr-2">
        <span className="inline-flex items-center gap-2 whitespace-nowrap border-r border-default bg-code-bg px-3.5 font-mono text-12 text-default shadow-[inset_0_2px_0_var(--fb-color-accent)]">
          <CodeFileIcon />
          flow.json
          {canSave ? <span className="size-[7px] rounded-full bg-accent" aria-label={t('codeEditor.unsavedChanges')} /> : null}
        </span>
        <div className="flex items-center gap-3.5 py-1.5">
          <span className="flex items-center gap-3 whitespace-nowrap text-11 text-subtle *:inline-flex *:items-center *:gap-[5px] narrow:hidden">
            <span>{formatRich(t('codeEditor.hints.find'), { keys: <kbd className={CODE_KBD_CLASS}>{labels.mod}F</kbd> })}</span>
            <span>{formatRich(t('codeEditor.hints.format'), { keys: <kbd className={CODE_KBD_CLASS}>{labels.shift}{labels.alt}F</kbd> })}</span>
            <span>{formatRich(t('codeEditor.hints.save'), { keys: <kbd className={CODE_KBD_CLASS}>{labels.mod}S</kbd> })}</span>
          </span>
          <Button variant="primary" size="sm" onClick={onSave} disabled={!canSave || disabled}>
            {saving ? t('codeEditor.saving') : t('codeEditor.saveChanges')}
          </Button>
        </div>
      </div>

      <div className="group relative flex h-[max(360px,calc(var(--fb-vh,100vh)-430px))] min-h-0 bg-code-bg narrow:h-[max(320px,calc(var(--fb-vh,100vh)*0.58))]">
        <div
          className="relative w-(--code-gutter-width) flex-none select-none overflow-hidden border-r border-transparent bg-code-bg pt-(--code-pad-top)"
          aria-hidden="true"
        >
          <div className="will-change-transform" ref={gutterRef}>
            {gutterRows}
          </div>
        </div>

        <div className="relative min-w-0 flex-auto">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute top-(--code-pad-top) right-0 left-0 will-change-transform" ref={bandsRef}>
              {Array.from(issueLines, (line) => (
                <div
                  key={`issue-${line}`}
                  className="absolute right-0 left-0 h-(--code-line-height) bg-danger-soft"
                  style={{ top: (line - 1) * M.lineHeight }}
                />
              ))}
              <div
                className="absolute right-0 left-0 h-(--code-line-height) bg-code-line-active"
                style={{ top: (caret.line - 1) * M.lineHeight }}
              />
            </div>
            <div className="absolute top-(--code-pad-top) right-0 left-(--code-pad-left) will-change-transform" ref={linesRef}>
              {lineElements}
            </div>
            <span
              className="fb-code-text pointer-events-none invisible absolute top-0 left-0 whitespace-pre"
              ref={rulerRef}
            >
              {RULER_SAMPLE}
            </span>
          </div>

          <textarea
            ref={textareaRef}
            className="fb-code-text fb-code-input"
            name="flow-json"
            aria-label={t('codeEditor.textareaLabel')}
            value={value}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            wrap="off"
            onChange={(event) => {
              onChange(event.target.value);
              syncCaret();
            }}
            onKeyDown={handleEditorKeyDown}
            onScroll={syncScroll}
            onSelect={syncCaret}
            onClick={syncCaret}
            onFocus={syncCaret}
          />

          {!value && !disabled ? (
            <div className="fb-code-text pointer-events-none absolute top-(--code-pad-top) right-(--code-pad-right) left-(--code-pad-left) text-subtle">
              {t('codeEditor.emptyHint')}
            </div>
          ) : null}

          {findOpen ? (
            <CodeFindWidget
              query={query}
              caseSensitive={caseSensitive}
              matchCount={matches.length}
              activeIndex={activeIndex}
              labels={labels}
              inputRef={findInputRef}
              onQueryChange={setQuery}
              onNavigate={navigateMatch}
              onToggleCaseSensitive={() => setCaseSensitive((current) => !current)}
              onClose={closeFind}
            />
          ) : null}

          <button
            type="button"
            className={cx(
              'absolute right-[22px] z-3 inline-flex h-7 items-center gap-1.5 rounded border bg-surface-raised px-2.5 text-12 font-semibold leading-none [transition:opacity_120ms_ease,color_120ms_ease,background_120ms_ease,top_160ms_ease] hover:bg-surface hover:text-default',
              findOpen ? 'top-20' : 'top-2.5',
              copied ? 'border-success text-success' : 'border-default text-muted',
              !value
                ? 'cursor-not-allowed opacity-30 group-hover:opacity-100'
                : copied
                  ? 'cursor-pointer opacity-100'
                  : 'cursor-pointer opacity-50 group-hover:opacity-100 focus-visible:opacity-100',
            )}
            onClick={() => void copyAll()}
            disabled={!value}
          >
            <CopyIcon done={copied} />
            {copied ? t('codeEditor.copied') : t('codeEditor.copy')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-default bg-code-chrome px-3 py-[7px] text-11.5 text-muted">
        <span className={cx(STATUS_ITEM_CLASS, STATUS_TONE_CLASSES[notice ? 'warning' : problemTone])}>
          <span aria-hidden="true">{notice ? '✳' : problemTone === 'ok' ? '✓' : '●'}</span>
          <span className="min-w-0 max-w-[40ch] truncate" title={notice ?? problemLabel}>
            {notice ?? problemLabel}
          </span>
        </span>
        <span className="flex-auto" />
        <span className={STATUS_ITEM_CLASS}>
          {t(caret.selected > 0 ? 'codeEditor.status.positionSelected' : 'codeEditor.status.position', {
            line: String(caret.line),
            column: String(caret.column),
            selected: String(caret.selected),
          })}
        </span>
        <span className={STATUS_ITEM_CLASS}>{t('codeEditor.status.spaces', { count: String(CODE_INDENT.length) })}</span>
        <span className={STATUS_ITEM_CLASS}>{t('codeEditor.status.lines', { count: lineCount })}</span>
        <span className={cx(STATUS_ITEM_CLASS, 'compact:hidden')}>JSON</span>
      </div>
    </section>
  );
}
