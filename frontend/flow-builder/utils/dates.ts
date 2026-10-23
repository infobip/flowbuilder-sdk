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

// Date helpers. Kept pure so card metadata can be formatted and tested
// without rendering the library.

import type { Translate } from '../i18n/I18nProvider';

// Convert a flow timestamp into a compact human label. Falls back to a local
// date/time for older values so the label remains stable. `locale` is the
// host's (undefined for the runtime default) and only shapes the absolute date;
// the relative wording comes from the catalogue.
export function relativeUpdatedLabel(
  value: string | null | undefined,
  t: Translate,
  locale?: string,
  now = new Date(),
): string {
  if (!value) return t('library.relative.unknown');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t('library.relative.unknown');

  const absMs = Math.abs(now.getTime() - parsed.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return t('library.relative.justNow');
  if (absMs < hour) return t('library.relative.minutesAgo', { count: Math.max(1, Math.round(absMs / minute)) });
  if (absMs < day) return t('library.relative.hoursAgo', { count: Math.max(1, Math.round(absMs / hour)) });
  if (absMs < 7 * day) return t('library.relative.daysAgo', { count: Math.max(1, Math.round(absMs / day)) });

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}
