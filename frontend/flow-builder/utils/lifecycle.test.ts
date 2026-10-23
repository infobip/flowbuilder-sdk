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
import {
  canDeleteEditorFlow,
  canFixEditorErrors,
  canPublishEditorFlow,
  canSaveEditorDraft,
  hasEditorUnsavedChanges,
  hasSaveableEditorChanges,
} from './lifecycle.ts';

test('hasEditorUnsavedChanges: detects title, prompt and json draft changes', () => {
  assert.equal(
    hasEditorUnsavedChanges({
      hasFlow: true,
      title: 'Booking',
      baselineTitle: 'Booking',
      prompt: 'Book an appointment',
      baselinePrompt: 'Book an appointment',
      jsonDraft: '{"version":"1.0"}',
      baselineJson: '{"version":"1.0"}',
    }),
    false,
  );

  assert.equal(
    hasEditorUnsavedChanges({
      hasFlow: true,
      title: 'Booking',
      baselineTitle: 'Draft',
      prompt: 'Book an appointment',
      baselinePrompt: 'Book an appointment',
      jsonDraft: '{"version":"1.0"}',
      baselineJson: '{"version":"1.0"}',
    }),
    true,
  );
});

test('hasEditorUnsavedChanges: ignores prompt-only edits before a flow exists', () => {
  assert.equal(
    hasEditorUnsavedChanges({
      hasFlow: false,
      title: 'Untitled flow',
      baselineTitle: 'Untitled flow',
      prompt: 'Build a booking flow',
      baselinePrompt: '',
      jsonDraft: '',
      baselineJson: '',
    }),
    false,
  );
});

test('hasSaveableEditorChanges: ignores prompt edits and watches title/json only', () => {
  assert.equal(
    hasSaveableEditorChanges({
      title: 'Booking',
      baselineTitle: 'Draft',
      jsonDraft: '{"version":"1.0"}',
      baselineJson: '{"version":"1.0"}',
    }),
    true,
  );

  assert.equal(
    hasSaveableEditorChanges({
      title: 'Draft',
      baselineTitle: 'Draft',
      jsonDraft: '{"version":"1.0"}',
      baselineJson: '{"version":"1.0"}',
    }),
    false,
  );
});

test('action gates reflect flow state and busy flags', () => {
  assert.equal(
    canSaveEditorDraft({ hasFlow: true, hasJsonError: false, busy: false, hasPersistableChanges: true }),
    true,
  );
  assert.equal(
    canSaveEditorDraft({ hasFlow: true, hasJsonError: true, busy: false, hasPersistableChanges: true }),
    false,
  );

  assert.equal(canDeleteEditorFlow({ hasFlow: true, flowStatus: 'DRAFT', busy: false }), true);
  assert.equal(canDeleteEditorFlow({ hasFlow: true, flowStatus: 'PUBLISHED', busy: false }), false);
  assert.equal(canDeleteEditorFlow({ hasFlow: false, flowStatus: 'DRAFT', busy: false }), false);

  assert.equal(
    canPublishEditorFlow({
      hasFlow: true,
      flowStatus: 'DRAFT',
      hasValidationErrors: false,
      hasJsonError: false,
      hasPersistableChanges: false,
      busy: false,
    }),
    true,
  );
  assert.equal(
    canPublishEditorFlow({
      hasFlow: true,
      flowStatus: 'PUBLISHED',
      hasValidationErrors: false,
      hasJsonError: false,
      hasPersistableChanges: false,
      busy: false,
    }),
    false,
  );

  assert.equal(
    canFixEditorErrors({ hasFlow: true, validationErrorCount: 1, hasJsonError: false, busy: false }),
    true,
  );
  assert.equal(
    canFixEditorErrors({ hasFlow: true, validationErrorCount: 0, hasJsonError: false, busy: false }),
    false,
  );
});
