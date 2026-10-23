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
import { applyPngUploadToDraft } from '../../flowJsonDraft.ts';
import {
  collectImageUploadSlots,
  isImageUploadSlotAvailable,
} from './imageUploads.ts';

const PLACEHOLDER = 'data:image/png;base64,PUT-YOUR-BASE64-HERE';
const UPLOADED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';

function flowWithSources(sources: string[]) {
  return {
    version: '6.0',
    screens: [
      {
        id: 'SCREEN',
        title: 'Screen',
        terminal: true,
        layout: {
          type: 'SingleColumnLayout',
          children: sources.map((src) => ({ type: 'Image', src })),
        },
      },
    ],
  };
}

test('creates one numbered upload slot per image component', () => {
  const draft = JSON.stringify(flowWithSources([PLACEHOLDER, PLACEHOLDER, PLACEHOLDER]));
  const slots = collectImageUploadSlots(draft);

  assert.deepEqual(slots.map((slot) => slot.number), [1, 2, 3]);
  assert.deepEqual(slots.map((slot) => slot.filled), [false, false, false]);
  assert.equal(new Set(slots.map((slot) => slot.key)).size, 3);
});

test('keeps filled images visible so every image can be replaced', () => {
  const draft = JSON.stringify(flowWithSources([UPLOADED_PNG, PLACEHOLDER, PLACEHOLDER]));
  const slots = collectImageUploadSlots(draft);

  assert.deepEqual(slots.map((slot) => slot.number), [1, 2, 3]);
  assert.deepEqual(slots.map((slot) => slot.filled), [true, false, false]);
});

test('edits the data example behind a dynamic image without replacing its template', () => {
  const draft = JSON.stringify({
    version: '6.0',
    screens: [{
      id: 'SCREEN',
      title: 'Screen',
      data: {
        first_image: { type: 'string', __example__: UPLOADED_PNG },
        second_image: { type: 'string', __example__: PLACEHOLDER },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          { type: 'Image', src: '${data.first_image}' },
          { type: 'Image', src: '${data.second_image}' },
        ],
      },
    }],
  });

  const slots = collectImageUploadSlots(draft);
  assert.deepEqual(slots.map((slot) => slot.number), [1, 2]);
  assert.deepEqual(slots.map((slot) => slot.filled), [true, false]);
  assert.deepEqual(slots.map((slot) => slot.path), [
    ['screens', 0, 'data', 'first_image', '__example__'],
    ['screens', 0, 'data', 'second_image', '__example__'],
  ]);
});

test('returns no controls for invalid JSON or JSON without images', () => {
  assert.deepEqual(collectImageUploadSlots('{'), []);
  assert.deepEqual(collectImageUploadSlots(JSON.stringify({
    version: '6.0',
    screens: [{ id: 'SCREEN', title: 'Screen', layout: { type: 'SingleColumnLayout', children: [] } }],
  })), []);
});

test('a selected slot remains available after upload and becomes replaceable', () => {
  const draft = JSON.stringify(flowWithSources([PLACEHOLDER]));
  const [slot] = collectImageUploadSlots(draft);
  assert.ok(slot);
  assert.equal(isImageUploadSlotAvailable(draft, slot), true);

  const result = applyPngUploadToDraft(draft, slot, 'UPLOADED_BASE64');
  const [uploadedSlot] = collectImageUploadSlots(result.nextDraftText);
  assert.equal(isImageUploadSlotAvailable(result.nextDraftText, slot), true);
  assert.equal(uploadedSlot.filled, true);
  assert.equal((result.nextFlow as any).screens[0].layout.children[0].src, 'UPLOADED_BASE64');
});

test('replaces an already-filled image at the same JSON path', () => {
  const draft = JSON.stringify(flowWithSources([UPLOADED_PNG]));
  const [slot] = collectImageUploadSlots(draft);
  assert.ok(slot?.filled);

  const result = applyPngUploadToDraft(draft, slot, 'REPLACEMENT_BASE64');
  const [replacementSlot] = collectImageUploadSlots(result.nextDraftText);
  assert.equal(replacementSlot.key, slot.key);
  assert.equal(replacementSlot.filled, true);
  assert.equal((result.nextFlow as any).screens[0].layout.children[0].src, 'REPLACEMENT_BASE64');
});

test('keeps filled data-source item images replaceable', () => {
  const draft = JSON.stringify({
    version: '6.0',
    screens: [{
      id: 'SCREEN',
      title: 'Screen',
      layout: {
        type: 'SingleColumnLayout',
        children: [{
          type: 'Dropdown',
          name: 'choice',
          label: 'Choice',
          'data-source': [{ id: 'one', title: 'One', image: UPLOADED_PNG }],
        }],
      },
    }],
  });

  const [slot] = collectImageUploadSlots(draft);
  assert.equal(slot.filled, true);
  assert.deepEqual(slot.path, ['screens', 0, 'layout', 'children', 0, 'data-source', 0, 'image']);
});
