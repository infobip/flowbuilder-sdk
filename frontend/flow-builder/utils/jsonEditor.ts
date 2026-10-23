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

import type { Translate } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';

export type JsonEditorValidationSource = {
  path?: string;
  message?: string;
  line?: number | null;
  column?: number | null;
  [key: string]: unknown;
};

export type JsonEditorValidationSeverity = 'error' | 'warning';

export type JsonEditorValidationIssue = JsonEditorValidationSource & {
  severity: JsonEditorValidationSeverity;
  line: number | null;
  column: number | null;
  index: number;
};

export function parseJsonDraft(value: string, t: Translate): { value: unknown | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: t('notices.errors.jsonEmpty') };

  try {
    return { value: JSON.parse(trimmed), error: null };
  } catch (error) {
    // The parser's own message is the browser's, not ours; only the fallback is translated.
    return { value: null, error: describeError(t, error, 'notices.errors.invalidJson') };
  }
}

export function formatJsonDraft(value: string, t: Translate): { value: string | null; error: string | null } {
  const parsed = parseJsonDraft(value, t);
  if (parsed.value == null) {
    return { value: null, error: parsed.error };
  }

  return { value: JSON.stringify(parsed.value, null, 2), error: null };
}

/** Half-open `[start, end)` offset pair into the draft text. */
export type TextRange = { start: number; end: number };

export function getJsonLineCount(value: string): number {
  return value.split(/\r\n|\r|\n/).length;
}

/** Content range of every line, excluding its line break. */
export function getJsonLineRanges(value: string): TextRange[] {
  const ranges: TextRange[] = [];
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === '\n') {
      ranges.push({ start, end: i });
      start = i + 1;
    } else if (char === '\r') {
      ranges.push({ start, end: i });
      const crlf = value[i + 1] === '\n';
      start = crlf ? i + 2 : i + 1;
      if (crlf) i += 1;
    }
  }
  ranges.push({ start, end: value.length });
  return ranges;
}

export function getJsonLineRange(value: string, line: number): TextRange | null {
  if (line < 1) return null;
  const ranges = getJsonLineRanges(value);
  return ranges[line - 1] ?? null;
}

export function indexToLineColumn(value: string, index: number): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, value.length));
  const prefix = value.slice(0, safeIndex);
  const lines = prefix.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: lines[lines.length - 1]?.length ?? 0,
  };
}

/** Hard cap so a one-character query on a huge draft can't stall the UI. */
const MAX_SEARCH_MATCHES = 5000;

/** Every non-overlapping hit for the find widget, in document order. */
export function findJsonMatches(
  value: string,
  query: string,
  options: { caseSensitive?: boolean } = {},
): TextRange[] {
  if (!query) return [];

  let haystack = value;
  let needle = query;
  if (!options.caseSensitive) {
    const loweredHaystack = value.toLowerCase();
    const loweredNeedle = query.toLowerCase();
    // Some locales change length when lowercased, which would shift offsets.
    if (loweredHaystack.length === value.length && loweredNeedle.length === query.length) {
      haystack = loweredHaystack;
      needle = loweredNeedle;
    }
  }

  const matches: TextRange[] = [];
  let fromIndex = 0;
  while (matches.length < MAX_SEARCH_MATCHES) {
    const index = haystack.indexOf(needle, fromIndex);
    if (index < 0) break;
    matches.push({ start: index, end: index + needle.length });
    fromIndex = index + needle.length;
  }
  return matches;
}

export function normalizeEditorValidationIssues(errors: JsonEditorValidationSource[], t: Translate): JsonEditorValidationIssue[] {
  return errors.map((error, index) => {
    const message = typeof error.message === 'string' && error.message.trim() ? error.message : t('editor.validation.unknownIssue');
    return {
      ...error,
      message,
      severity: error.line != null || error.column != null ? 'warning' : 'error',
      line: typeof error.line === 'number' && Number.isFinite(error.line) ? error.line : null,
      column: typeof error.column === 'number' && Number.isFinite(error.column) ? error.column : null,
      index,
    };
  });
}

export function formatValidationLocation(issue: JsonEditorValidationIssue, t: Translate): string {
  // Line numbers go in as text so they are never given thousands separators.
  if (issue.line != null) {
    if (issue.column != null) {
      return t('editor.validation.lineColumn', { line: String(issue.line), column: String(issue.column) });
    }
    return t('editor.validation.line', { line: String(issue.line) });
  }
  if (issue.path) {
    return issue.path;
  }
  return t('editor.validation.noLineInfo');
}
