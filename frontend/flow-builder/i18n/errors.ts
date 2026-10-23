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

// ── Error messages ─────────────────────────────────────────────────────────
//
// Turns a thrown error into text for the UI.
//
// The rule: English has always shown the server's own text, and that must not
// change. So a message from the catalogue replaces it only when the host has
// translated that message (its value differs from `en`; `t.isOverridden`):
//
//   1. a `FlowBuilderApiError` whose `code` has an `errors.codes.<CODE>` key
//      the host translated → that message (`{status}` is available);
//   2. a `TypeError` (what `fetch` throws when it gets no response) and a
//      translated `errors.network` → that message;
//   3. otherwise the error's own message, as before;
//   4. an error with no message → `t(fallback)`.
//
// A `t` without `isOverridden` (a stand-in in a test) is treated as
// untranslated, so rules 1 and 2 are skipped.

import { FlowBuilderApiError } from '../../api';
import type { Translate } from './I18nProvider';
import { en } from './en';
import type { MessageKey } from './messages';

function hasCodeMessage(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(en.errors.codes, code);
}

export function describeError(t: Translate, error: unknown, fallback: MessageKey): string {
  if (error instanceof FlowBuilderApiError && error.code && hasCodeMessage(error.code)) {
    const key = `errors.codes.${error.code}` as MessageKey;
    if (t.isOverridden?.(key)) return t(key, { status: error.status });
  }
  if (error instanceof TypeError && t.isOverridden?.('errors.network')) return t('errors.network');
  if (error instanceof Error && error.message) return error.message;
  return t(fallback);
}
