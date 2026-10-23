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

// Every rule ships in the compiled stylesheet (the WhatsApp preview's included,
// whatsapp-flow-preview/preview.css), so nothing may create a <style> element at
// runtime: a strict `style-src` CSP would block it. Constructable stylesheets
// (element/) and `style` props go through the CSSOM and are fine.
const FEATURE_DIR = join(process.cwd(), 'frontend', 'flow-builder');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ["createElement('style')", /createElement\(\s*['"`]style['"`]\s*\)/],
  ['createElementNS(..., "style")', /createElementNS\([^)]*['"`]style['"`]\s*\)/],
  ['insertAdjacentHTML with <style', /insertAdjacentHTML\([^)]*<style/i],
  ['innerHTML/outerHTML with <style', /(inner|outer)HTML\s*=[^;]*<style/i],
  ['a style element\'s textContent/innerHTML', /\bstyle\w*\.(textContent|innerHTML|innerText)\s*=/i],
  ['document.write with <style', /document\.write(ln)?\([^)]*<style/i],
];

test('no frontend source creates a <style> element at runtime', () => {
  const files = sources(FEATURE_DIR);
  assert.ok(files.length > 50, 'found suspiciously few sources');
  const found: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const [label, pattern] of FORBIDDEN) {
      if (pattern.test(text)) found.push(`${relative(process.cwd(), file)}: ${label}`);
    }
  }
  assert.deepEqual(found, [], 'runtime <style> injection; put the rules in a stylesheet imported from styles/app.css');
});

test('the scan patterns catch the usual ways of injecting a <style>', () => {
  const samples = [
    "document.createElement('style')",
    'document.createElement("style")',
    "el.insertAdjacentHTML('beforeend', '<style>a{}</style>')",
    'styleEl.textContent = css',
    'host.innerHTML = `<style>a{}</style>`',
  ];
  for (const sample of samples) assert.ok(FORBIDDEN.some(([, pattern]) => pattern.test(sample)), sample);
});
