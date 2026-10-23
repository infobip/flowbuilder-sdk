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
import {
  applyTextEdit,
  autoPairEdit,
  diffEdit,
  indentEdit,
  isCaretMove,
  newlineEdit,
  outdentEdit,
  pairDeleteEdit,
  type EditorSelection,
  type TextEdit,
} from '../../utils/codeEditor.ts';

/** `|` marks the caret, `[` and `]` wrap a selection. */
function parse(marked: string): EditorSelection {
  if (marked.includes('|')) {
    const selectionStart = marked.indexOf('|');
    return { value: marked.replace('|', ''), selectionStart, selectionEnd: selectionStart };
  }
  const selectionStart = marked.indexOf('[');
  const selectionEnd = marked.indexOf(']') - 1;
  return { value: marked.replace('[', '').replace(']', ''), selectionStart, selectionEnd };
}

function render(state: EditorSelection, edit: TextEdit | null): string {
  assert.ok(edit, 'expected an edit');
  const next = applyTextEdit(state.value, edit);
  return next.selectionStart === next.selectionEnd
    ? `${next.value.slice(0, next.selectionStart)}|${next.value.slice(next.selectionStart)}`
    : `${next.value.slice(0, next.selectionStart)}[${next.value.slice(next.selectionStart, next.selectionEnd)}]${next.value.slice(next.selectionEnd)}`;
}

test('indentEdit: a caret advances to the next tab stop, not a fixed width', () => {
  const atColumnThree = parse('{"a|": 1}');
  assert.equal(render(atColumnThree, indentEdit(atColumnThree)), '{"a |": 1}');
  const atColumnZero = parse('|"a": 1');
  assert.equal(render(atColumnZero, indentEdit(atColumnZero)), '  |"a": 1');
});

test('indentEdit: a multi-line selection indents every non-blank line', () => {
  const state = parse('[a\nb\n\nc]\n');
  assert.equal(render(state, indentEdit(state)), '[  a\n  b\n\n  c]\n');
});

test('outdentEdit: strips one level and keeps the caret in place', () => {
  const state = parse('    "a|": 1');
  assert.equal(render(state, outdentEdit(state)), '  "a|": 1');
});

test('outdentEdit: returns null when there is nothing to strip', () => {
  assert.equal(outdentEdit(parse('"a|": 1')), null);
});

test('newlineEdit: keeps the current indentation', () => {
  const state = parse('  "a": 1,|');
  assert.equal(render(state, newlineEdit(state)), '  "a": 1,\n  |');
});

test('newlineEdit: opens a block when the caret sits between brackets', () => {
  const state = parse('  "screens": [|]');
  assert.equal(render(state, newlineEdit(state)), '  "screens": [\n    |\n  ]');
});

test('autoPairEdit: auto-closes brackets and quotes', () => {
  const braces = parse('|');
  assert.equal(render(braces, autoPairEdit(braces, '{')), '{|}');
  const quotes = parse('{ |}');
  assert.equal(render(quotes, autoPairEdit(quotes, '"')), '{ "|"}');
});

test('autoPairEdit: wraps a selection instead of replacing it', () => {
  const state = parse('{ [title] }');
  assert.equal(render(state, autoPairEdit(state, '"')), '{ "[title]" }');
});

test('autoPairEdit: does not pair in front of a word, or inside a string', () => {
  assert.equal(autoPairEdit(parse('|title'), '"'), null);
  assert.equal(autoPairEdit(parse('"he|llo"'), '{'), null);
});

test('autoPairEdit: typing a closing bracket steps over the auto-inserted one', () => {
  const state = parse('{|}');
  const edit = autoPairEdit(state, '}');
  assert.ok(edit && isCaretMove(edit));
  assert.equal(render(state, edit), '{}|');
});

test('pairDeleteEdit: backspace between an empty pair removes both halves', () => {
  const state = parse('{"a": [|]}');
  assert.equal(render(state, pairDeleteEdit(state)), '{"a": |}');
  assert.equal(pairDeleteEdit(parse('{"a|b"}')), null);
});

test('diffEdit: narrows a reformat to the range that actually changed', () => {
  const previous = '{"a":1,"b":2}';
  const edit = diffEdit(previous, '{"a":1,"b":22}');
  assert.ok(edit);
  assert.equal(edit.text, '2');
  assert.equal(edit.rangeStart, previous.indexOf('}'));
  assert.equal(edit.rangeEnd, previous.indexOf('}'));
  assert.equal(diffEdit('same', 'same'), null);
});
