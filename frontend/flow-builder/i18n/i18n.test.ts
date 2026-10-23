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
import { join, relative } from 'node:path';
import { formatMessage } from './format.ts';
import { createI18n } from './I18nProvider.tsx';
import { lookupMessage, mergeMessages, type FlowBuilderMessages, type MessageKey } from './messages.ts';
import { en } from './en/index.ts';

const FEATURE_DIR = join(process.cwd(), 'frontend', 'flow-builder');

test('formatMessage: replaces named values and leaves unknown ones visible', () => {
  assert.equal(formatMessage('en', 'Delete {name}?', { name: 'Survey' }), 'Delete Survey?');
  assert.equal(formatMessage('en', 'Delete {name}?', {}), 'Delete {name}?');
  assert.equal(formatMessage('en', 'No params {here}'), 'No params {here}');
});

test('formatMessage: plurals follow the locale, exact matches win, # is the formatted number', () => {
  const template = '{count|=0:No flows|one:# flow|other:# flows}';
  assert.equal(formatMessage('en', template, { count: 0 }), 'No flows');
  assert.equal(formatMessage('en', template, { count: 1 }), '1 flow');
  assert.equal(formatMessage('en', template, { count: 1234 }), '1,234 flows');
  assert.equal(formatMessage('de', template, { count: 1234 }), '1.234 flows');
  // Polish has a `few` category English doesn't.
  const pl = '{count|one:# plik|few:# pliki|many:# plików|other:# pliku}';
  assert.equal(formatMessage('pl', pl, { count: 3 }), '3 pliki');
  assert.equal(formatMessage('pl', pl, { count: 5 }), '5 plików');
});

test('mergeMessages: overrides strings, falls back to English, ignores unknown keys and wrong shapes', () => {
  const merged = mergeMessages({
    common: { productName: 'Acme Flows' },
    // @ts-expect-error unknown keys are dropped at runtime too
    nope: { x: 'y' },
  });
  assert.equal(merged.common.productName, 'Acme Flows');
  assert.equal((merged as unknown as Record<string, unknown>).nope, undefined);
  // A non-string where a string belongs keeps English.
  const wrong = mergeMessages({ common: { productName: 42 as unknown as string } });
  assert.equal(wrong.common.productName, en.common.productName);
  // The English catalogue itself is never mutated.
  assert.equal(en.common.productName, 'AI Flow Builder');
});

test('lookupMessage: unknown keys come back as the key', () => {
  assert.equal(lookupMessage(en, 'common.productName'), 'AI Flow Builder');
  assert.equal(lookupMessage(en, 'common.missing' as MessageKey), 'common.missing');
});

test('createI18n: t formats in the host locale; dates use Intl', () => {
  const i18n = createI18n({ locale: 'de', messages: { common: { productName: 'Flow-Baukasten' } } });
  assert.equal(i18n.t('common.productName'), 'Flow-Baukasten');
  assert.equal(i18n.formatNumber(1234.5), '1.234,5');
  assert.equal(i18n.formatDate('2026-03-01T12:00:00Z', { month: 'long', timeZone: 'UTC' }), 'März');
  assert.equal(i18n.formatDate('not a date'), '');
});

// ── Catalogue hygiene ──────────────────────────────────────────────────────

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function leafKeys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key));
}

test('every message key used in the code exists in en', () => {
  // `t('area.key'` and `t("area.key"` with a literal key. Keys built at
  // runtime are typed as MessageKey, which the type-checker covers.
  const known = new Set(leafKeys(en));
  const missing: string[] = [];
  for (const file of sourceFiles(FEATURE_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      if (!known.has(match[1])) missing.push(`${relative(FEATURE_DIR, file)}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every English message is a non-empty string with balanced braces', () => {
  const bad: string[] = [];
  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      let depth = 0;
      for (const ch of node) {
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (depth < 0 || depth > 1) break;
      }
      if (!node.trim() || depth !== 0) bad.push(path);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) visit(value, path ? `${path}.${key}` : key);
  };
  visit(en satisfies FlowBuilderMessages, '');
  assert.deepEqual(bad, []);
});
