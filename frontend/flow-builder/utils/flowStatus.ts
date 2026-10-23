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

// Presentation helpers for a flow's lifecycle status. Maps the domain
// `FlowStatus` (from `frontend/shared.ts`) onto a Badge tone + human label.
// Pure — safe to unit test and reuse anywhere in the app.

import type { FlowStatus } from '../../shared';
import type { BadgeTone } from '../components/badge/Badge';
import { createI18n, type Translate } from '../i18n/I18nProvider';

export type StatusPresentation = {
  label: string;
  tone: BadgeTone;
};

const STATUS_TONES: Record<FlowStatus, BadgeTone> = {
  none: 'neutral',
  DRAFT: 'warning',
  PUBLISHED: 'success',
  DEPRECATED: 'neutral',
  BLOCKED: 'danger',
  THROTTLED: 'danger',
};

// English until the caller passes its `t`, so a screen not yet translated keeps working.
const defaultT = createI18n().t;

export function presentStatus(status: FlowStatus, t: Translate = defaultT): StatusPresentation {
  const known = status in STATUS_TONES ? status : 'none';
  return { label: t(`library.status.${known}`), tone: STATUS_TONES[known] };
}

// Only DRAFT flows can be published from the library.
export function canPublish(status: FlowStatus): boolean {
  return status === 'DRAFT';
}

// Only DRAFT flows can also be deleted.
export function canDelete(status: FlowStatus): boolean {
  return status === 'DRAFT';
}
