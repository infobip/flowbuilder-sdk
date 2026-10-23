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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHighlightedLines, tokenizeJson } from '../../utils/jsonHighlight.ts';

function typesOf(source: string, ...slices: string[]): string[] {
  const tokens = tokenizeJson(source);
  return slices.map((slice) => {
    const start = source.indexOf(slice);
    return tokens.find((token) => token.start === start)?.type ?? 'missing';
  });
}

test('tokenizeJson: separates keys from string values', () => {
  const source = '{"title": "Welcome"}';
  assert.deepEqual(typesOf(source, '"title"', '"Welcome"'), ['key', 'string']);
});

test('tokenizeJson: classifies numbers, literals and punctuation', () => {
  const source = '{"a": -12.5, "b": true, "c": null}';
  assert.deepEqual(typesOf(source, '-12.5', 'true', 'null'), ['number', 'literal', 'literal']);
  assert.equal(tokenizeJson(source)[0].type, 'punctuation');
});

test('tokenizeJson: covers every character with no gaps', () => {
  const source = '{\n  "a": [1, 2],\n  "b": "x"\n}';
  const tokens = tokenizeJson(source);
  assert.equal(tokens[0].start, 0);
  assert.equal(tokens[tokens.length - 1].end, source.length);
  for (let i = 1; i < tokens.length; i += 1) {
    assert.equal(tokens[i].start, tokens[i - 1].end);
  }
});

test('tokenizeJson: an unterminated string stops at the line break', () => {
  const source = '{\n  "broken: 1\n}';
  const tokens = tokenizeJson(source);
  const broken = tokens.find((token) => token.type === 'string' || token.type === 'key');
  assert.ok(broken);
  assert.equal(source.slice(broken.start, broken.end), '"broken: 1');
});

test('buildHighlightedLines: one segment list per line, concatenating to the source', () => {
  const source = '{\n  "a": 1\n}';
  const lines = buildHighlightedLines(source);
  assert.equal(lines.length, 3);
  assert.equal(lines.map((segments) => segments.map((segment) => segment.text).join('')).join('\n'), source);
});

test('buildHighlightedLines: marks the active match apart from the others', () => {
  const source = '{"a": "demo", "b": "demo"}';
  const matches = [
    { start: source.indexOf('demo'), end: source.indexOf('demo') + 4 },
    { start: source.lastIndexOf('demo'), end: source.lastIndexOf('demo') + 4 },
  ];
  const segments = buildHighlightedLines(source, matches, 1).flat();
  const hits = segments.filter((segment) => segment.text === 'demo');
  assert.deepEqual(hits.map((hit) => hit.match), ['match', 'active']);
  // Matches cut inside a string token without losing the token colour.
  assert.deepEqual(hits.map((hit) => hit.type), ['string', 'string']);
});
