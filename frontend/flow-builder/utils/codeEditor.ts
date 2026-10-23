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

// ── Code editor text operations ────────────────────────────────────────────
//
// Editor keystrokes (Tab, Enter, bracket pairs, format) are expressed as pure
// `TextEdit` descriptors rather than "here is the new document". The editor
// replays them through `document.execCommand('insertText')`, which keeps the
// browser's native undo/redo stack intact — the thing users lose the moment a
// textarea's value is rewritten wholesale.

export const CODE_INDENT = '  ';

/** A replacement of `[rangeStart, rangeEnd)` plus where the caret ends up. */
export type TextEdit = {
  rangeStart: number;
  rangeEnd: number;
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

export type EditorSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const OPENERS: Record<string, string> = { '{': '}', '[': ']', '"': '"' };
const CLOSERS = new Set(['}', ']']);
/** Characters an auto-inserted closer may sit in front of. */
const PAIR_FOLLOWERS = new Set(['', ' ', '\t', '\n', '\r', ',', '}', ']', ')', ':']);

export function lineStartAt(value: string, index: number): number {
  const before = value.lastIndexOf('\n', Math.max(0, index - 1));
  return before < 0 ? 0 : before + 1;
}

export function lineEndAt(value: string, index: number): number {
  const after = value.indexOf('\n', index);
  return after < 0 ? value.length : after;
}

export function applyTextEdit(value: string, edit: TextEdit): EditorSelection {
  return {
    value: value.slice(0, edit.rangeStart) + edit.text + value.slice(edit.rangeEnd),
    selectionStart: edit.selectionStart,
    selectionEnd: edit.selectionEnd,
  };
}

/** True when the edit only moves the caret (stepping over a closing pair). */
export function isCaretMove(edit: TextEdit): boolean {
  return edit.text === '' && edit.rangeStart === edit.rangeEnd;
}

function caretMove(from: number, to: number): TextEdit {
  return { rangeStart: from, rangeEnd: from, text: '', selectionStart: to, selectionEnd: to };
}

/** Odd number of unescaped quotes before the caret on its line. */
function isInsideString(value: string, index: number): boolean {
  let quotes = 0;
  for (let i = lineStartAt(value, index); i < index; i += 1) {
    if (value[i] === '\\') {
      i += 1;
      continue;
    }
    if (value[i] === '"') quotes += 1;
  }
  return quotes % 2 === 1;
}

function outdentWidth(line: string): number {
  if (line.startsWith('\t')) return 1;
  let width = 0;
  while (width < CODE_INDENT.length && line[width] === ' ') width += 1;
  return width;
}

/** Tab: indent every selected line, or advance the caret to the next tab stop. */
export function indentEdit(state: EditorSelection): TextEdit {
  const { value, selectionStart, selectionEnd } = state;

  if (value.slice(selectionStart, selectionEnd).includes('\n')) {
    const blockStart = lineStartAt(value, selectionStart);
    const blockEnd = lineEndAt(value, selectionEnd);
    const text = value
      .slice(blockStart, blockEnd)
      .split('\n')
      .map((line) => (line.trim() ? CODE_INDENT + line : line))
      .join('\n');
    return { rangeStart: blockStart, rangeEnd: blockEnd, text, selectionStart: blockStart, selectionEnd: blockStart + text.length };
  }

  const column = selectionStart - lineStartAt(value, selectionStart);
  const text = ' '.repeat(CODE_INDENT.length - (column % CODE_INDENT.length));
  const caret = selectionStart + text.length;
  return { rangeStart: selectionStart, rangeEnd: selectionEnd, text, selectionStart: caret, selectionEnd: caret };
}

/** Shift+Tab: strip one indent level from every selected line. */
export function outdentEdit(state: EditorSelection): TextEdit | null {
  const { value, selectionStart, selectionEnd } = state;
  const blockStart = lineStartAt(value, selectionStart);
  const blockEnd = lineEndAt(value, selectionEnd);
  const lines = value.slice(blockStart, blockEnd).split('\n');

  let removedTotal = 0;
  let removedBeforeStart = 0;
  let removedBeforeEnd = 0;
  let lineStart = blockStart;

  const next = lines.map((line) => {
    const width = outdentWidth(line);
    if (width > 0) {
      removedTotal += width;
      // A caret sitting inside the stripped indent collapses to the line start.
      if (selectionStart > lineStart) removedBeforeStart += Math.min(width, selectionStart - lineStart);
      if (selectionEnd > lineStart) removedBeforeEnd += Math.min(width, selectionEnd - lineStart);
    }
    lineStart += line.length + 1;
    return line.slice(width);
  });

  if (removedTotal === 0) return null;

  return {
    rangeStart: blockStart,
    rangeEnd: blockEnd,
    text: next.join('\n'),
    selectionStart: selectionStart - removedBeforeStart,
    selectionEnd: selectionEnd - removedBeforeEnd,
  };
}

/** Enter: keep the current indent, and open a block when between brackets. */
export function newlineEdit(state: EditorSelection): TextEdit {
  const { value, selectionStart, selectionEnd } = state;
  const before = value.slice(lineStartAt(value, selectionStart), selectionStart);
  const baseIndent = /^[ \t]*/.exec(before)?.[0] ?? '';
  const opensBlock = /[{[]$/.test(before.trimEnd());
  const closesBlock = /^\s*[}\]]/.test(value.slice(selectionEnd, lineEndAt(value, selectionEnd)));
  const innerIndent = opensBlock ? baseIndent + CODE_INDENT : baseIndent;

  const text = opensBlock && closesBlock
    ? `\n${innerIndent}\n${baseIndent}`
    : `\n${innerIndent}`;
  const caret = selectionStart + 1 + innerIndent.length;

  return { rangeStart: selectionStart, rangeEnd: selectionEnd, text, selectionStart: caret, selectionEnd: caret };
}

/** Bracket and quote pairing: wrap a selection, auto-close, or step over. */
export function autoPairEdit(state: EditorSelection, char: string): TextEdit | null {
  const { value, selectionStart, selectionEnd } = state;
  const closer = OPENERS[char];

  if (selectionEnd > selectionStart) {
    if (!closer) return null;
    const selected = value.slice(selectionStart, selectionEnd);
    return {
      rangeStart: selectionStart,
      rangeEnd: selectionEnd,
      text: char + selected + closer,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1 + selected.length,
    };
  }

  const nextChar = value[selectionStart] ?? '';
  const insideString = isInsideString(value, selectionStart);

  if (char === '"') {
    if (insideString) return nextChar === '"' ? caretMove(selectionStart, selectionStart + 1) : null;
    if (!PAIR_FOLLOWERS.has(nextChar)) return null;
    return { rangeStart: selectionStart, rangeEnd: selectionStart, text: '""', selectionStart: selectionStart + 1, selectionEnd: selectionStart + 1 };
  }

  if (closer) {
    if (insideString || !PAIR_FOLLOWERS.has(nextChar)) return null;
    return {
      rangeStart: selectionStart,
      rangeEnd: selectionStart,
      text: char + closer,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1,
    };
  }

  if (CLOSERS.has(char) && !insideString && nextChar === char) return caretMove(selectionStart, selectionStart + 1);
  return null;
}

/** Backspace between an empty pair removes both halves. */
export function pairDeleteEdit(state: EditorSelection): TextEdit | null {
  const { value, selectionStart, selectionEnd } = state;
  if (selectionStart !== selectionEnd || selectionStart === 0) return null;
  const pair = value.slice(selectionStart - 1, selectionStart + 1);
  if (pair !== '{}' && pair !== '[]' && pair !== '""') return null;
  return {
    rangeStart: selectionStart - 1,
    rangeEnd: selectionStart + 1,
    text: '',
    selectionStart: selectionStart - 1,
    selectionEnd: selectionStart - 1,
  };
}

/**
 * Narrow a whole-document rewrite (formatting, "fix errors") to the range that
 * actually changed, so undo stays one step and the viewport barely moves.
 */
export function diffEdit(previous: string, next: string): TextEdit | null {
  if (previous === next) return null;

  const max = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < max && previous[prefix] === next[prefix]) prefix += 1;

  let suffix = 0;
  while (suffix < max - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;

  const text = next.slice(prefix, next.length - suffix);
  const caret = prefix + text.length;
  return { rangeStart: prefix, rangeEnd: previous.length - suffix, text, selectionStart: caret, selectionEnd: caret };
}
