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
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ── Guard: no hard-coded user-facing text in the UI ────────────────────────
//
// Every visible string goes through the message catalogue (i18n/en/), so a
// host can translate it. This scans the `.tsx` files of the UI folders for
//   - JSX text nodes with letters:        <span>Hello</span>
//   - string-literal text attributes:     aria-label="…"  title="…"
//                                         placeholder="…"  label="…" …
// and fails with file:line for each. Use `{t('area.key')}` instead.
//
// Not caught (by design, to stay simple): text inside JS expressions such as
// `{cond ? 'Yes' : 'No'}` or props built in `.ts` files; review covers those.

const FEATURE_DIR = join(process.cwd(), 'frontend', 'flow-builder');
const SCANNED_DIRS = ['pages', 'features', 'components', 'app', 'public', 'element'];

// `whatsapp-flow-preview/` is not in SCANNED_DIRS: it shows the customer's own flow content.

// Text with no letters is a glyph, not wording ('▤', '☾', '+', '×', '—'), so it
// never needs listing. Letters that are a proper noun or a literal go here as
// `path:text`, relative to frontend/flow-builder.
const ALLOWED_TEXT = new Set<string>([
  // The find widget's match-case toggle: the conventional glyph, labelled by aria-label.
  'features/editor/CodeFindWidget.tsx:Aa',
  // The editor tab's file name and the status bar's language: literals, not wording.
  'features/editor/JsonCodeEditor.tsx:flow.json',
  'features/editor/JsonCodeEditor.tsx:JSON',
]);

const TEXT_ATTRIBUTES = ['aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'title', 'placeholder', 'label', 'alt', 'ariaLabel', 'confirmLabel', 'retryLabel', 'eyebrow', 'subtitle', 'description', 'message', 'hint', 'emptyText'];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

// Blanks comments and string/template contents that sit in code (not in JSX
// attributes) while keeping every offset and newline, so line numbers hold.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));
}

function lineOf(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

export type Finding = { line: number; text: string };

/** Hard-coded user-facing text in one `.tsx` source. Exported for the tests below. */
export function findHardcodedText(source: string): Finding[] {
  const code = stripComments(source);
  const findings: Finding[] = [];

  // JSX text: between a tag's `>` and the next `<` or `{`. Not after `=>`
  // (arrow) and not containing code punctuation, which excludes generics and
  // comparisons.
  for (const match of code.matchAll(/(?<![=-])>([^<>{}=;()&|]*)(?=[<{])/g)) {
    const text = match[1].trim().replace(/\s+/g, ' ');
    // Text that opens with punctuation follows a tag inside an object or array
    // literal; a `? '…'` is a ternary after a `>` comparison (`count > 0 ? …`).
    if (/^[,;:)\]]/.test(text) || /\?\s*['"`]/.test(text) || !/\p{L}/u.test(text)) continue;
    const offset = (match.index ?? 0) + 1 + match[1].search(/\S/);
    findings.push({ line: lineOf(source, offset), text });
  }

  // Text attributes with a plain string literal value.
  const attributes = new RegExp(`(?<![\\w.-])(${TEXT_ATTRIBUTES.join('|')})=(?:"([^"]*)"|\\{\\s*['"\`]([^'"\`]*)['"\`]\\s*\\})`, 'g');
  for (const match of code.matchAll(attributes)) {
    const text = (match[2] ?? match[3] ?? '').trim();
    // `${…}` holes are code, not wording.
    if (!/\p{L}/u.test(text.replace(/\$\{[^}]*\}/g, ''))) continue;
    findings.push({ line: lineOf(source, match.index ?? 0), text });
  }

  return findings;
}

test('no hard-coded user-facing text in the UI folders', () => {
  const offenders: string[] = [];
  for (const dir of SCANNED_DIRS) {
    let files: string[] = [];
    try {
      files = tsxFiles(join(FEATURE_DIR, dir));
    } catch {
      continue; // a folder this branch doesn't have
    }
    for (const file of files) {
      const rel = relative(FEATURE_DIR, file).split(sep).join('/');
      for (const { line, text } of findHardcodedText(readFileSync(file, 'utf8'))) {
        if (ALLOWED_TEXT.has(`${rel}:${text}`)) continue;
        offenders.push(`${rel}:${line}  ${JSON.stringify(text)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'Move this text into i18n/en/ and render it with t(...). Offenders:\n' + offenders.join('\n'));
});

test('the guard finds JSX text and text attributes, and ignores glyphs, code and comments', () => {
  const bad = findHardcodedText(`
const a = <span>Hello</span>;
const b = <button aria-label="Close">x</button>;
const c = (
  <p>
    Some wording {name}
  </p>
);
const d = <Input placeholder="Search" label={'Name'} />;
const e = <b>Delete it?</b>;
`);
  assert.deepEqual(
    bad.map((f) => `${f.line}:${f.text}`).sort(),
    ['10:Delete it?', '2:Hello', '3:Close', '3:x', '6:Some wording', '9:Name', '9:Search'],
  );

  const ok = findHardcodedText(`
// <span>Hello</span> in a comment
/* <b>Hello</b> */
const g = useState<string>(null);
const f = (x: number) => x > 1 && x < 3;
const h = items.map((i) => <li key={i}>{t('a.b')}</li>);
const i = <span aria-hidden="true">×</span>;
const j = <button aria-label={t('a.b')} title={label} className="Foo bar">☾</button>;
const k = <span>{t(count > 0 ? 'a.some' : 'a.none', {</span>;
`);
  assert.deepEqual(ok, []);
});
