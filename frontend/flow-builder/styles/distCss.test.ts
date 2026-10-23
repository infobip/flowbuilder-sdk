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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT_SELECTOR, selectorList, stripComments, styleRules } from './cssScope.ts';

// Checks the stylesheet the package ships. It only exists after `npm run build`
// (scripts/build-lib.mjs), so without a build these tests skip.
const DIST_CSS = join(process.cwd(), 'dist', 'styles.css');
const skip = existsSync(DIST_CSS) ? false : 'dist/styles.css is missing; run `npm run build` to check the shipped stylesheet';
const css = () => stripComments(readFileSync(DIST_CSS, 'utf8'));

test('dist/styles.css only styles the builder root', { skip }, () => {
  const escaped: string[] = [];
  for (const { selector, within } of styleRules(css())) {
    if (within.some((at) => /^@(keyframes|font-face|property)\b/.test(at))) continue;
    if (within.includes('@layer properties')) continue;
    for (const part of selectorList(selector)) if (!ROOT_SELECTOR.test(part)) escaped.push(part);
  }
  assert.deepEqual(escaped, [], 'selectors that reach outside [data-flowbuilder-root]');
  assert.doesNotMatch(css(), /:root/, 'the stylesheet mentions :root');
  const keyframes = Array.from(css().matchAll(/@keyframes\s+([\w-]+)/g), (match) => match[1]);
  assert.deepEqual(keyframes.filter((name) => !name.startsWith('fb-')), [], 'keyframes without the fb- prefix');
});

test('dist/styles.css loads its fonts from ./fonts/', { skip }, () => {
  const faces = Array.from(css().matchAll(/@font-face\s*\{[^}]*\}/g), (match) => match[0]);
  assert.ok(faces.length > 0, 'no @font-face found');
  for (const face of faces) {
    const urls = Array.from(face.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g), (match) => match[1]);
    assert.ok(urls.length > 0, `no url() in ${face}`);
    for (const url of urls) assert.match(url, /^\.\/fonts\/[\w.-]+\.woff2$/, `font URL ${url} is not relative`);
  }
  assert.doesNotMatch(css(), /\/frontend\/assets/, 'the stylesheet points at the standalone app assets');
});

// The text properties a host page can push into the builder, by inheritance or
// through its own `*` rule (styles/isolation.css).
const ISOLATED_TEXT_PROPS = [
  'letter-spacing', 'word-spacing', 'font-style', 'font-variant', 'text-transform', 'text-shadow', 'text-indent',
  'text-align', 'white-space', 'cursor', 'text-decoration', 'font-family', 'font-size', 'font-weight', 'line-height', 'color',
];

const declarationsOf = (selector: string) => {
  const blocks = Array.from(css().matchAll(/([^{}]+)\{([^{}]*)\}/g)).filter((m) => selectorList(m[1].trim()).includes(selector));
  return blocks.map((m) => m[2]);
};

test('dist/styles.css resets inherited text properties on the root and inherits them on every descendant', { skip }, () => {
  const root = declarationsOf('[data-flowbuilder-root]').join(';');
  const universal = declarationsOf('[data-flowbuilder-root] *').join(';');
  for (const prop of ISOLATED_TEXT_PROPS.filter((p) => !['font-family', 'font-size', 'font-weight', 'line-height', 'color'].includes(p))) {
    assert.match(root, new RegExp(`(^|;)\\s*${prop}:\\s*(?!inherit)[^;]+`), `the root does not set ${prop}`);
  }
  for (const prop of ISOLATED_TEXT_PROPS) {
    assert.match(universal, new RegExp(`(^|;)\\s*${prop}:\\s*(inherit|none)\\b`), `[data-flowbuilder-root] * does not take ${prop} from its parent`);
  }
  // The inheriting rule must come before the utilities, so a utility (a class on top of the root) still wins.
  const text = css();
  assert.ok(text.indexOf('[data-flowbuilder-root] *{') < text.indexOf('[data-flowbuilder-root] .text-'), 'the inherit rule must precede the utilities');
});
