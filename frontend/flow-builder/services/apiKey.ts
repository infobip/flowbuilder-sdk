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

// ── Flow Builder API key settings ──────────────────────────────────────────
//
// The settings page's window onto the Infobip credential. The key itself never
// reaches the browser: the proxy holds it (from `INFOBIP_API_KEY` or from an
// in-memory override set here) and only ever reports which of the two is in
// play plus the last four characters. That keeps the rule the service layer
// documents — components never see or store the key — while still letting a
// rotated key be swapped in without editing `.env` and restarting.
//
// An override lasts for the life of the server process, which is why the
// settings page says so next to the field.

import { apiCall, type ApiOptions } from '../../api';

/** `env` is the key from the server's environment; `override` was set here. */
export type ApiKeySource = 'env' | 'override';

export type ApiKeyStatus = {
  source: ApiKeySource;
  /** Last four characters of the active key, or '' when it is too short to hint at. */
  hint: string;
};

const ENDPOINT = '/settings/api-key';

const MASK = '••••••••';

const AUTH_SCHEME = /^app\s+/i;

/**
 * Accept what people actually paste: the bare key, or the whole
 * `App <key>` Authorization value copied out of the Infobip docs or a curl
 * example. Keys never contain whitespace, so a leading `App ` can only be the
 * scheme rather than part of the credential.
 *
 * The server normalizes again, because it is the side that builds the header
 * and cannot trust its caller. This copy exists so the settings form can tell
 * whether a paste actually contains a key — `App ` alone is an empty field,
 * not something worth sending.
 */
export function normalizeApiKey(value: string): string {
  return value.trim().replace(AUTH_SCHEME, '').trim();
}

/** Render a status hint as the familiar dots-plus-last-four credential label. */
export function maskApiKey(hint: string): string {
  return hint ? `${MASK}${hint}` : MASK;
}

function coerceStatus(value: unknown): ApiKeyStatus {
  const raw = (value ?? {}) as { source?: unknown; hint?: unknown };
  return {
    source: raw.source === 'override' ? 'override' : 'env',
    hint: typeof raw.hint === 'string' ? raw.hint : '',
  };
}

export async function getApiKeyStatus(options?: ApiOptions): Promise<ApiKeyStatus> {
  return coerceStatus(await apiCall(options, 'Load API key', ENDPOINT, 'GET'));
}

/**
 * Called after the active credential changed. Flow documents are memoised per
 * builder instance and are scoped to whichever credential fetched them, so they
 * cannot outlive a key change — otherwise the library keeps rendering the
 * previous account's flows. The caller passes its instance's cache clear here,
 * so dropping it stays part of the credential change itself.
 */
export type CredentialChangeHandler = () => void;

/**
 * Point the server at a different key. It verifies the candidate against
 * Infobip first, so a rejected key leaves the previous one in place and throws
 * with a message worth showing.
 */
export async function setApiKey(
  apiKey: string,
  options?: ApiOptions,
  onCredentialChange?: CredentialChangeHandler,
): Promise<ApiKeyStatus> {
  const status = coerceStatus(
    await apiCall(options, 'Save API key', ENDPOINT, 'PUT', { apiKey: normalizeApiKey(apiKey) }),
  );
  onCredentialChange?.();
  return status;
}

/** Drop the override and go back to the key in the server's environment. */
export async function clearApiKey(
  options?: ApiOptions,
  onCredentialChange?: CredentialChangeHandler,
): Promise<ApiKeyStatus> {
  const status = coerceStatus(await apiCall(options, 'Reset API key', ENDPOINT, 'DELETE'));
  onCredentialChange?.();
  return status;
}
