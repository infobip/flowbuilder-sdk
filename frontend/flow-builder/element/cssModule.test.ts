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
import { cssModuleSource } from '../../../scripts/css-module.mjs';

// The element build turns dist/styles.css into a module whose font URLs are
// resolved against the script's own URL at runtime.
test('cssModuleSource resolves relative font URLs against import.meta.url', async () => {
  const css = "@font-face{src:url(./fonts/a.woff2) format('woff2')}.x{background:url(data:x)}";
  const source = cssModuleSource(css);
  assert.match(source, /new URL\("\.\.\/fonts\/a\.woff2", import\.meta\.url\)/);
  const run = source.replace(/import\.meta\.url/g, JSON.stringify('https://cdn.example/pkg/element/index.js'));
  const url = `data:text/javascript,${encodeURIComponent(run)}`;
  const { default: out } = await import(url);
  assert.equal(out, "@font-face{src:url(https://cdn.example/pkg/fonts/a.woff2) format('woff2')}.x{background:url(data:x)}");
});

test('cssModuleSource leaves CSS without fonts untouched', async () => {
  const run = cssModuleSource('.a{color:red}');
  const { default: out } = await import(`data:text/javascript,${encodeURIComponent(run)}`);
  assert.equal(out, '.a{color:red}');
});
