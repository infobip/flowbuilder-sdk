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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createI18n } from '../i18n/I18nProvider';
import { describeSettingsSections as describe } from './settingsSections';

const { t } = createI18n();
const describeSettingsSections = (features: Parameters<typeof describe>[1]) => describe(t, features);

const ALL = { themeSwitch: true, brandPicker: true, chatHistoryBackup: true, apiKeySettings: true };

test('describeSettingsSections: the standalone subtitle is unchanged', () => {
  assert.equal(describeSettingsSections(ALL).subtitle, 'Appearance, chat history, and the API key this builder runs on.');
});

test('describeSettingsSections: never mentions the API key when it is hidden', () => {
  const { subtitle } = describeSettingsSections({ ...ALL, apiKeySettings: false });
  assert.equal(subtitle, 'Appearance and chat history.');
});

test('describeSettingsSections: drops Appearance when theme and brand are both off', () => {
  const result = describeSettingsSections({ ...ALL, themeSwitch: false, brandPicker: false, apiKeySettings: false });
  assert.equal(result.appearance, false);
  assert.equal(result.subtitle, 'Chat history.');
  assert.equal(describeSettingsSections({ themeSwitch: false, brandPicker: true, chatHistoryBackup: false, apiKeySettings: false }).appearance, true);
});
