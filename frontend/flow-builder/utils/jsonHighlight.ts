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

// ── JSON syntax highlighting ───────────────────────────────────────────────
//
// The code editor paints a highlight layer underneath a transparent textarea,
// so highlighting has to be a pure string → segments transform (no DOM, no
// third-party highlighter). The tokenizer is deliberately forgiving: the draft
// is invalid JSON for most of the time a user is typing in it, so it never
// throws and always covers the whole input.

import { getJsonLineRanges, type TextRange } from './jsonEditor';

export type JsonTokenType = 'key' | 'string' | 'number' | 'literal' | 'punctuation' | 'plain';

export type JsonToken = TextRange & { type: JsonTokenType };

/** How a segment intersects the active find query. */
export type SegmentMatch = 'none' | 'match' | 'active';

export type HighlightSegment = {
  text: string;
  type: JsonTokenType;
  match: SegmentMatch;
};

const PUNCTUATION = new Set(['{', '}', '[', ']', ',', ':']);
const LITERALS = ['true', 'false', 'null'];

function isDigit(char: string | undefined): boolean {
  return char != null && char >= '0' && char <= '9';
}

/** Tokens cover every character of `source` with no gaps. */
export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];

  const push = (start: number, end: number, type: JsonTokenType) => {
    const previous = tokens[tokens.length - 1];
    // Runs of filler and punctuation collapse so long drafts stay cheap to render.
    if (previous && previous.end === start && previous.type === type && (type === 'plain' || type === 'punctuation')) {
      previous.end = end;
      return;
    }
    tokens.push({ start, end, type });
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index];

    if (char === '"') {
      let cursor = index + 1;
      while (cursor < source.length) {
        const current = source[cursor];
        if (current === '\\') {
          cursor += 2;
          continue;
        }
        if (current === '"') {
          cursor += 1;
          break;
        }
        // An unterminated string stops at the line break instead of eating the file.
        if (current === '\n' || current === '\r') break;
        cursor += 1;
      }
      const end = Math.min(cursor, source.length);
      let lookahead = end;
      while (lookahead < source.length && /\s/.test(source[lookahead])) lookahead += 1;
      push(index, end, source[lookahead] === ':' ? 'key' : 'string');
      index = end;
      continue;
    }

    if (isDigit(char) || (char === '-' && isDigit(source[index + 1]))) {
      let cursor = index + 1;
      while (cursor < source.length && /[0-9.eE+-]/.test(source[cursor])) cursor += 1;
      push(index, cursor, 'number');
      index = cursor;
      continue;
    }

    const literal = LITERALS.find((word) => source.startsWith(word, index));
    if (literal) {
      push(index, index + literal.length, 'literal');
      index += literal.length;
      continue;
    }

    push(index, index + 1, PUNCTUATION.has(char) ? 'punctuation' : 'plain');
    index += 1;
  }

  return tokens;
}

/**
 * Split the draft into one segment list per line, cut at token *and* find-match
 * boundaries so a match can be styled across differently coloured tokens.
 */
export function buildHighlightedLines(
  source: string,
  matches: readonly TextRange[] = [],
  activeMatchIndex = -1,
): HighlightSegment[][] {
  const tokens = tokenizeJson(source);
  const lines = getJsonLineRanges(source);
  const result: HighlightSegment[][] = [];

  let lineTokenIndex = 0;
  let lineMatchIndex = 0;

  for (const line of lines) {
    while (lineTokenIndex < tokens.length && tokens[lineTokenIndex].end <= line.start) lineTokenIndex += 1;
    while (lineMatchIndex < matches.length && matches[lineMatchIndex].end <= line.start) lineMatchIndex += 1;

    const segments: HighlightSegment[] = [];
    let tokenIndex = lineTokenIndex;
    let matchIndex = lineMatchIndex;
    let cursor = line.start;

    while (cursor < line.end) {
      while (tokenIndex < tokens.length && tokens[tokenIndex].end <= cursor) tokenIndex += 1;
      while (matchIndex < matches.length && matches[matchIndex].end <= cursor) matchIndex += 1;

      const token = tokens[tokenIndex];
      const match = matches[matchIndex];
      const inToken = token != null && token.start <= cursor;
      const inMatch = match != null && match.start <= cursor;

      const nextTokenCut = token ? (inToken ? token.end : token.start) : line.end;
      const nextMatchCut = match ? (inMatch ? match.end : match.start) : line.end;
      const cut = Math.min(line.end, nextTokenCut, nextMatchCut);

      segments.push({
        text: source.slice(cursor, cut),
        type: inToken ? token.type : 'plain',
        match: inMatch ? (matchIndex === activeMatchIndex ? 'active' : 'match') : 'none',
      });
      cursor = cut;
    }

    result.push(segments);
  }

  return result;
}
