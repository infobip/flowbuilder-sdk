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
import { createI18n } from '../i18n/I18nProvider.tsx';
import { presentStatus, canDelete, canPublish } from './flowStatus.ts';

const { t } = createI18n();

test('presentStatus: maps each known status to a label + tone', () => {
  assert.deepEqual(presentStatus('DRAFT', t), { label: 'Draft', tone: 'warning' });
  assert.deepEqual(presentStatus('PUBLISHED', t), { label: 'Published', tone: 'success' });
  assert.deepEqual(presentStatus('BLOCKED', t), { label: 'Blocked', tone: 'danger' });
  assert.deepEqual(presentStatus('none', t), { label: 'New', tone: 'neutral' });
});

test('presentStatus: unknown statuses read as new', () => {
  assert.deepEqual(presentStatus('ARCHIVED' as never, t), { label: 'New', tone: 'neutral' });
});

test('canPublish: only DRAFT flows can be published', () => {
  assert.equal(canPublish('DRAFT'), true);
  assert.equal(canPublish('PUBLISHED'), false);
  assert.equal(canPublish('none'), false);
  assert.equal(canPublish('BLOCKED'), false);
});

test('canDelete: only DRAFT flows can be deleted', () => {
  assert.equal(canDelete('DRAFT'), true);
  assert.equal(canDelete('PUBLISHED'), false);
  assert.equal(canDelete('none'), false);
  assert.equal(canDelete('THROTTLED'), false);
});
