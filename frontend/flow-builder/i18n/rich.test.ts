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
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatRich } from './rich.tsx';

const html = (nodes: React.ReactNode[]) => renderToStaticMarkup(React.createElement('p', null, nodes));
const strong = (text: string) => React.createElement('strong', null, text);

test('formatRich: puts a node where the placeholder is', () => {
  assert.equal(html(formatRich('Permanently delete {name}? Sure.', { name: strong('Survey') })), '<p>Permanently delete <strong>Survey</strong>? Sure.</p>');
});

test('formatRich: translators can reorder and repeat placeholders', () => {
  assert.equal(html(formatRich('{b} before {a}, {b}', { a: strong('A'), b: strong('B') })), '<p><strong>B</strong> before <strong>A</strong>, <strong>B</strong></p>');
});

test('formatRich: plain templates and unknown placeholders come back as written', () => {
  assert.deepEqual(formatRich('Nothing here', {}), ['Nothing here']);
  assert.equal(html(formatRich('Hi {who}', {})), '<p>Hi {who}</p>');
});
