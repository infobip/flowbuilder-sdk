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
import { buildElementProps, isSafeImageUrl, parseLayout, parsePreset, parseRouting, parseThemeMode, wantsFonts } from './attributes.ts';

const noCallbacks = {};

test('parses enumerated attributes and falls back to the embed defaults', () => {
  assert.equal(parseThemeMode('dark'), 'dark');
  assert.equal(parseThemeMode('purple'), undefined);
  assert.equal(parseThemeMode(null), undefined);
  assert.equal(parsePreset('default'), 'default');
  assert.equal(parsePreset('nope'), undefined);
  assert.equal(parseRouting(null), 'memory');
  assert.equal(parseRouting('hash'), 'hash');
  assert.equal(parseRouting('weird'), 'memory');
  assert.equal(parseLayout(null), 'fill');
  assert.equal(parseLayout('page'), 'page');
  assert.equal(wantsFonts(null), true);
  assert.equal(wantsFonts('none'), false);
});

test('maps attributes to props', () => {
  const props = buildElementProps(
    { 'api-base-url': '/api-proxy', 'theme-mode': 'system', preset: 'default', routing: 'hash', layout: 'page', 'storage-key': 'a' },
    {},
    noCallbacks,
  );
  assert.equal(props.apiBaseUrl, '/api-proxy');
  assert.deepEqual(props.theme, { mode: 'system', preset: 'default' });
  assert.equal(props.routing, 'hash');
  assert.equal(props.layout, 'page');
  assert.equal(props.storageKey, 'a');
});

test('defaults: memory routing, fill layout, no theme, empty base url', () => {
  const props = buildElementProps({}, {}, noCallbacks);
  assert.equal(props.routing, 'memory');
  assert.equal(props.layout, 'fill');
  assert.equal(props.theme, undefined);
  assert.equal(props.apiBaseUrl, undefined);
  assert.equal(props.storageKey, undefined);
});

test('the theme property wins over theme attributes, field by field', () => {
  const props = buildElementProps({ 'theme-mode': 'dark', preset: 'default' }, { theme: { mode: 'light', tokens: {} } }, noCallbacks);
  assert.equal(props.theme?.mode, 'light');
  assert.equal(props.theme?.preset, 'default');
  assert.deepEqual(props.theme?.tokens, {});
});

test('rich properties pass through', () => {
  const getHeaders = () => ({ a: 'b' });
  const props = buildElementProps({}, { getHeaders, features: { delete: false } }, noCallbacks);
  assert.equal(props.getHeaders, getHeaders);
  assert.deepEqual(props.features, { delete: false });
});

test('brand logo becomes an <img> for safe URLs and is dropped otherwise', () => {
  const ok = buildElementProps({}, { brand: { logo: ' https://x.test/logo.svg ', productName: 'Acme' } }, noCallbacks);
  const logo = ok.brand?.logo as { type: string; props: { src: string; alt: string } };
  assert.equal(logo.type, 'img');
  assert.equal(logo.props.src, 'https://x.test/logo.svg');
  assert.equal(logo.props.alt, 'Acme');
  assert.equal(ok.brand?.productName, 'Acme');

  const bad = buildElementProps({}, { brand: { logo: 'javascript:alert(1)', tagline: 't' } }, noCallbacks);
  assert.equal(bad.brand?.logo, undefined);
  assert.equal(bad.brand?.tagline, 't');
  assert.equal(buildElementProps({}, {}, noCallbacks).brand, undefined);
});

test('isSafeImageUrl allows http(s), relative and data:image, refuses other schemes', () => {
  for (const url of ['https://a/b.png', 'http://a/b.png', '/logo.svg', './logo.svg', '//cdn/x.png', 'data:image/svg+xml;base64,AAA']) {
    assert.equal(isSafeImageUrl(url), true, url);
  }
  for (const url of ['', '  ', 'javascript:alert(1)', 'JaVaScRiPt:x', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd']) {
    assert.equal(isSafeImageUrl(url), false, url);
  }
});
