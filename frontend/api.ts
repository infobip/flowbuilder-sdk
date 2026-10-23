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

export type ApiOptions = {
  /**
   * Where the flow routes are mounted: the `basePath` of
   * `createFlowBuilderHandler`, or the Express router's mount path. Relative
   * (`/flowbuilder/api`) or absolute (`https://api.example.com/flowbuilder`).
   * Defaults to `/api`, the standalone server's mount; `/` means the origin root.
   */
  apiBaseUrl?: string;
  signal?: AbortSignal;
  /** Extra headers for every request (e.g. the host's own auth). Called per request. */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Replaces the global `fetch` (e.g. a host's authenticated client). */
  fetch?: typeof fetch;
  /** Passed to `fetch` as-is. */
  credentials?: RequestCredentials;
  /** Called when a request answers 401, before the error is thrown. */
  onUnauthorized?: () => void;
  /**
   * Called with every error `apiCall` throws except aborts. Internal: the
   * builder's `ApiConfigProvider` sets it to forward failures to the host's
   * `onError`; hosts don't pass it.
   */
  onError?: (error: unknown) => void;
};

/**
 * A non-OK answer from the flow routes (`server/core.ts`). `message` is the server's `error`
 * text (or `<label> failed (HTTP n)`), `code` the server's machine-readable
 * `code` when it sent one. Network failures (no response at all) are not
 * wrapped: `fetch`'s own `TypeError` propagates as before.
 */
export class FlowBuilderApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'FlowBuilderApiError';
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

function isAbortError(error: unknown): boolean {
  return (error instanceof Error && error.name === 'AbortError')
    || (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError');
}

/** Reports a thrown error to `options.onError`, except for aborts. */
export function reportApiError(options: ApiOptions | undefined, error: unknown) {
  if (!isAbortError(error)) options?.onError?.(error);
}

/**
 * The one place a request is sent: applies the host's `fetch`, `credentials`
 * and per-request `getHeaders` (over `init.headers`), and calls
 * `onUnauthorized` on a 401. Returns the raw `Response`.
 */
export async function apiRequest(options: ApiOptions | undefined, url: string, init: RequestInit = {}): Promise<Response> {
  const extraHeaders = (await options?.getHeaders?.()) ?? {};
  const requestInit: RequestInit = {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...extraHeaders },
    ...(options?.credentials ? { credentials: options.credentials } : null),
    ...(options?.signal ? { signal: options.signal } : null),
  };
  const doFetch = options?.fetch ?? fetch;
  const res = await doFetch(url, requestInit);
  if (res.status === 401) options?.onUnauthorized?.();
  return res;
}

export const DEFAULT_API_BASE_URL = '/api';

/** The mount point without a trailing slash, so `${base}/flows` is always one slash. */
export function getApiBaseUrl(options?: ApiOptions) {
  return (options?.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export async function apiCall<T = unknown>(
  options: ApiOptions | undefined,
  label: string,
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  try {
    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await apiRequest(options, `${getApiBaseUrl(options)}${url}`, init);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new FlowBuilderApiError(
        data?.error || `${label} failed (HTTP ${res.status})`,
        res.status,
        typeof data?.code === 'string' ? data.code : undefined,
      );
    }

    return data as T;
  } catch (error) {
    reportApiError(options, error);
    throw error;
  }
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
