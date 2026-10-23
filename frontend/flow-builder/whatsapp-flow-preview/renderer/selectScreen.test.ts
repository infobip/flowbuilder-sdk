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
import { normalizeFlowDocument, pickScreen, collectRenderableChildren } from './selectScreen.ts';
import type { PreviewRenderContext } from '../types.ts';

function ctx(overrides: Partial<PreviewRenderContext> = {}): PreviewRenderContext {
  return {
    data: {},
    form: {},
    interactive: false,
    screen: { id: 'S' },
    ...overrides,
  };
}

test('normalizeFlowDocument: parses strings, unwraps { flow }, rejects junk', () => {
  const obj = { version: '6.0', screens: [{ id: 'A' }] };
  assert.deepEqual(normalizeFlowDocument(obj), obj);
  assert.deepEqual(normalizeFlowDocument(JSON.stringify(obj)), obj);
  assert.deepEqual(normalizeFlowDocument({ flow: obj }), obj);
  assert.equal(normalizeFlowDocument('not json'), null);
  assert.equal(normalizeFlowDocument({ version: '6.0' }), null); // no screens
  assert.equal(normalizeFlowDocument(null), null);
});

test('pickScreen: id match, else first screen', () => {
  const doc = { screens: [{ id: 'A' }, { id: 'B' }] };
  assert.equal(pickScreen(doc, 'B')?.id, 'B');
  assert.equal(pickScreen(doc, 'MISSING')?.id, 'A');
  assert.equal(pickScreen(doc)?.id, 'A');
  assert.equal(pickScreen({ screens: [] }), null);
});

test('collectRenderableChildren: splits trailing Footer and drops hidden nodes', () => {
  const screen = {
    id: 'S',
    layout: {
      children: [
        { type: 'TextHeading', text: 'Hi' },
        { type: 'TextBody', text: 'hidden', visible: false },
        { type: 'Footer', label: 'Next' },
      ],
    },
  };
  const content = collectRenderableChildren(screen, ctx());
  assert.equal(content.body.length, 1);
  assert.equal(content.body[0].type, 'TextHeading');
  assert.equal(content.footer?.type, 'Footer');
});

test('collectRenderableChildren: flattens Form container, pinning its Footer', () => {
  const screen = {
    id: 'RATE',
    layout: {
      type: 'SingleColumnLayout',
      children: [
        {
          type: 'Form',
          name: 'flow_path',
          children: [
            { type: 'CheckboxGroup', name: 'choose', 'data-source': [{ id: '0', title: 'One' }] },
            { type: 'Footer', label: 'Done' },
          ],
        },
      ],
    },
  };
  const content = collectRenderableChildren(screen, ctx());
  assert.equal(content.body.length, 1);
  assert.equal(content.body[0].type, 'CheckboxGroup');
  assert.equal(content.footer?.type, 'Footer');
  assert.equal(content.footer?.label, 'Done');
});

test('collectRenderableChildren: expands If via condition', () => {
  const screen = {
    id: 'S',
    layout: {
      children: [
        { type: 'If', condition: '${data.flag}', then: [{ type: 'TextBody', text: 'yes' }], else: [{ type: 'TextBody', text: 'no' }] },
      ],
    },
  };
  const yes = collectRenderableChildren(screen, ctx({ data: { flag: true } }));
  assert.equal(yes.body[0].text, 'yes');
  const no = collectRenderableChildren(screen, ctx({ data: { flag: false } }));
  assert.equal(no.body[0].text, 'no');
});
