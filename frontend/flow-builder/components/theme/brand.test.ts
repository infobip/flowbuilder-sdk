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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BRANDS } from '../../styles/tokens.ts';
import { BRAND_ICONS, DEFAULT_BRAND, parseBrand } from './brand.ts';

test('a stored brand reads back as itself', () => {
  for (const brand of BRANDS) assert.equal(parseBrand(brand), brand);
});

test('anything that is not a brand falls back to the default look', () => {
  assert.equal(DEFAULT_BRAND, 'default');
  for (const value of [null, undefined, '', 'Custom', 'default ', 'dark']) assert.equal(parseBrand(value), 'default');
});

// Tests run from a bundle in a temp dir, so files are found from the repo root.
test("every brand's tab icon exists", () => {
  for (const brand of BRANDS) {
    const icon = BRAND_ICONS[brand];
    assert.match(icon, /^\/frontend\/assets\/[\w-]+\.svg$/);
    assert.ok(existsSync(join(process.cwd(), icon)), `${brand}: ${icon} is missing`);
  }
});
