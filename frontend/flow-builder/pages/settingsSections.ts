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

import type { ResolvedFlowBuilderFeatures } from '../app/hostConfig';
import type { Translate } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

type SettingsFeatures = Pick<ResolvedFlowBuilderFeatures, 'themeSwitch' | 'brandPicker' | 'chatHistoryBackup' | 'apiKeySettings'>;

// One whole sentence per combination of sections (not a list joined from
// fragments), so translators control word order and punctuation.
const SUBTITLE_KEYS: Record<string, MessageKey> = {
  '100': 'settings.subtitle.appearance',
  '010': 'settings.subtitle.chatHistory',
  '001': 'settings.subtitle.apiKey',
  '110': 'settings.subtitle.appearanceChatHistory',
  '101': 'settings.subtitle.appearanceApiKey',
  '011': 'settings.subtitle.chatHistoryApiKey',
  '111': 'settings.subtitle.all',
};

/** Which Settings sections show, and a subtitle that names only those. */
export function describeSettingsSections(t: Translate, features: SettingsFeatures): { appearance: boolean; subtitle: string } {
  const appearance = features.themeSwitch || features.brandPicker;
  const key = SUBTITLE_KEYS[[appearance, features.chatHistoryBackup, features.apiKeySettings].map((on) => (on ? '1' : '0')).join('')];
  return { appearance, subtitle: key ? t(key) : '' };
}
