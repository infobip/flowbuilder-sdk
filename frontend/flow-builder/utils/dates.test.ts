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
import { relativeUpdatedLabel } from './dates.ts';
import { createI18n } from '../i18n/I18nProvider.tsx';

const { t } = createI18n();

test('relativeUpdatedLabel: handles missing and invalid values', () => {
  assert.equal(relativeUpdatedLabel(null, t, undefined, new Date('2026-08-31T12:00:00Z')), '—');
  assert.equal(relativeUpdatedLabel('not-a-date', t, undefined, new Date('2026-08-31T12:00:00Z')), '—');
});

test('relativeUpdatedLabel: renders relative labels for recent timestamps', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  assert.equal(relativeUpdatedLabel('2026-08-31T11:59:40Z', t, undefined, now), 'just now');
  assert.equal(relativeUpdatedLabel('2026-08-31T11:52:00Z', t, undefined, now), '8 mins ago');
  assert.equal(relativeUpdatedLabel('2026-08-31T10:00:00Z', t, undefined, now), '2 hours ago');
  assert.equal(relativeUpdatedLabel('2026-08-29T12:00:00Z', t, undefined, now), '2 days ago');
});

test('relativeUpdatedLabel: singular units, and older dates follow the locale', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  assert.equal(relativeUpdatedLabel('2026-08-31T11:59:00Z', t, undefined, now), '1 min ago');
  assert.equal(relativeUpdatedLabel('2026-08-31T11:00:00Z', t, undefined, now), '1 hour ago');
  assert.equal(relativeUpdatedLabel('2026-08-30T12:00:00Z', t, undefined, now), '1 day ago');
  assert.equal(relativeUpdatedLabel('2026-03-01T12:00:00Z', t, 'en-US', now), 'Mar 1, 2026');
  assert.equal(relativeUpdatedLabel('2026-03-01T12:00:00Z', createI18n({ locale: 'de' }).t, 'de', now), '1. März 2026');
});
