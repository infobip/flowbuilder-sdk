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

// Preview API client for the editor's live mobile preview.
//
// This wraps the `GET {apiBaseUrl}/flow-preview/:flowId` proxy contract.

import { apiRequest, getApiBaseUrl, delay, reportApiError, type ApiOptions } from '../../api';
import { createI18n, type Translate } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';

export type PreviewStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type PreviewKind = 'iframe' | 'image';

export type FlowPreviewState = {
  status: PreviewStatus;
  kind: PreviewKind | null;
  url: string;
  error: string | null;
  /** ISO timestamp after which the preview URL stops working, when provided. */
  expiresAt: string | null;
};

// Backoff schedule for transient post-save 404s: freshly created flows can take
// a few seconds to expose their live preview URL, so we retry long enough to
// cover the same indexing window as the JSON save path.
export const PREVIEW_RETRY_DELAYS = [1000, 2000, 3000, 5000, 8000, 8000];

export const IDLE_PREVIEW: FlowPreviewState = { status: 'idle', kind: null, url: '', error: null, expiresAt: null };

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// English, for callers that don't pass a translator.
const defaultTranslate: Translate = createI18n().t;

function isUnavailablePreview(error: unknown): boolean {
  const message = toMessage(error, '').toLowerCase();
  return message.includes('404') || message.includes('not found') || message.includes('expired');
}

function classifyError(error: unknown, t: Translate): FlowPreviewState {
  const status = isUnavailablePreview(error) ? 'unavailable' : 'error';
  return { status, kind: null, url: '', error: describeError(t, error, 'preview.errors.unavailable'), expiresAt: null };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
    || error instanceof Error && error.name === 'AbortError';
}

/**
 * Fetch a live preview for a flow.
 *
 * Handles both response shapes the proxy can emit:
 *  - JSON `{ previewUrl, expiresAt }` (or a bare URL string) → rendered in an iframe.
 *  - An image / octet-stream body → wrapped in an object URL and rendered as an image.
 *
 * When `kind` is `'image'`, the returned `url` is an object URL that the caller
 * owns and must `URL.revokeObjectURL` when it is replaced or unmounted.
 *
 * `t` words the errors this module makes up (English when omitted); messages
 * from the server are passed through as they are.
 */
export async function fetchFlowPreview(
  flowId: string,
  options?: ApiOptions,
  t: Translate = defaultTranslate,
): Promise<FlowPreviewState> {
  const baseUrl = getApiBaseUrl(options);

  try {
    for (let attempt = 0; attempt <= PREVIEW_RETRY_DELAYS.length; attempt += 1) {
      const res = await apiRequest(options, `${baseUrl}/flow-preview/${flowId}`, {
        method: 'GET',
        headers: { Accept: 'application/json, image/*, application/octet-stream' },
      });

      const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
      const isJson = contentType.includes('application/json') || contentType.includes('text/json');
      const isImage = contentType.startsWith('image/');
      const isBinary = contentType.includes('application/octet-stream');

      if (!res.ok) {
        const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
        const message =
          body && typeof body === 'object' && !Array.isArray(body) && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
            ? String((body as { error?: unknown }).error)
            : typeof body === 'string' && body.trim()
              ? body
              : t('preview.errors.httpFailed', { status: String(res.status) });
        const notReady = res.status === 404 || /not found|expired/i.test(message);
        if (notReady && attempt < PREVIEW_RETRY_DELAYS.length) {
          await delay(PREVIEW_RETRY_DELAYS[attempt]);
          continue;
        }
        return classifyError(new Error(message), t);
      }

      if (isImage || isBinary) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return { status: 'ready', kind: 'image', url: objectUrl, error: null, expiresAt: null };
      }

      const data = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
      const previewUrl =
        data && typeof data === 'object' && !Array.isArray(data)
          ? (typeof (data as { previewUrl?: unknown }).previewUrl === 'string' && (data as { previewUrl?: string }).previewUrl)
            || (typeof (data as { url?: unknown }).url === 'string' && (data as { url?: string }).url)
            || ''
          : typeof data === 'string'
            ? data
            : '';
      const expiresAt =
        data && typeof data === 'object' && !Array.isArray(data) && typeof (data as { expiresAt?: unknown }).expiresAt === 'string'
          ? (data as { expiresAt?: string }).expiresAt ?? null
          : null;

      if (!previewUrl.trim()) {
        if (attempt < PREVIEW_RETRY_DELAYS.length) {
          await delay(PREVIEW_RETRY_DELAYS[attempt]);
          continue;
        }
        return { status: 'unavailable', kind: null, url: '', error: t('preview.errors.unavailable'), expiresAt: null };
      }

      return { status: 'ready', kind: 'iframe', url: previewUrl, error: null, expiresAt };
    }

    return { status: 'unavailable', kind: null, url: '', error: t('preview.errors.unavailable'), expiresAt: null };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    // Only transport failures land here; HTTP errors are classified above and
    // 404s are expected while a fresh flow's preview is still being indexed.
    reportApiError(options, error);
    return classifyError(error, t);
  }
}
