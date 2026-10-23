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
import { buildShadowCss, extractFontFaces, propertyFallbackCss } from './styles.ts';

const css = `@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}
@property --tw-blur{syntax:"*";inherits:false}
@property --tw-ring-offset-width{syntax:"<length>";inherits:false;initial-value:0}
@font-face{font-family:'FB IBM Plex Sans';src:url(/a.woff2) format('woff2')}
[data-flowbuilder-root]{color:red}`;

test('@property initial values become zero-specificity declarations on the root', () => {
  const out = propertyFallbackCss(css);
  assert.match(out, /--tw-shadow:0 0 #0000/);
  assert.match(out, /--tw-ring-offset-width:0/);
  assert.doesNotMatch(out, /--tw-blur/);
  assert.ok(out.startsWith(':where('));
});

test('no @property with an initial value means no fallback rule', () => {
  assert.equal(propertyFallbackCss('a{b:c}'), '');
});

test('extractFontFaces returns only the @font-face rules', () => {
  const faces = extractFontFaces(css);
  assert.match(faces, /^@font-face/);
  assert.doesNotMatch(faces, /data-flowbuilder-root/);
  assert.equal(extractFontFaces('a{b:c}'), '');
});

test('buildShadowCss keeps the original css and adds the host sizing', () => {
  const out = buildShadowCss(css);
  assert.ok(out.includes(css));
  assert.match(out, /:host\{display:block/);
});
