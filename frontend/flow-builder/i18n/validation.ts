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

// ── Validation messages ────────────────────────────────────────────────────
//
// The flow validator (src/validators/) reports each problem with a stable
// `code` and its English `message`. This turns an issue into text for the UI:
// a code the catalogue knows (`validation.<code>`) is translated with the
// issue's params; anything else (Infobip's own validation errors, older
// issues without a code) shows its `message` as before.

import { FLOW_VALIDATION_ERROR_CODES } from '../../../src/validators/flow-validator';
import type { MessageKey } from './messages';
import type { MessageParams, Translate } from './I18nProvider';

export type TranslatableIssue = {
  message?: string;
  code?: unknown;
  params?: unknown;
};

const KNOWN_CODES: ReadonlySet<string> = new Set(FLOW_VALIDATION_ERROR_CODES);

// Only strings and numbers can be interpolated; anything else is dropped.
function toParams(value: unknown): MessageParams | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const params: MessageParams = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry))) params[key] = entry;
  }
  return params;
}

export function describeValidationIssue(t: Translate, issue: TranslatableIssue, fallback: string): string {
  if (typeof issue.code === 'string' && KNOWN_CODES.has(issue.code)) {
    return t(`validation.${issue.code}` as MessageKey, toParams(issue.params));
  }
  return typeof issue.message === 'string' && issue.message.trim() ? issue.message : fallback;
}
