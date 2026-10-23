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

// English messages for the `errors.*` keys.
//
// `codes.*` are the `code`s the server sends (server/core.ts). The UI shows the
// server's own text unless a host has translated the code's message — see
// `describeError` in ../errors.ts. `{status}` is the HTTP status.

export const errors = {
  /** A failed `fetch` (no response at all). */
  network: 'Could not reach the server.',
  unknown: 'Something went wrong.',
  codes: {
    INVALID_JSON: 'The request was not valid JSON.',
    PAYLOAD_TOO_LARGE: 'The request is too large.',
    BAD_REQUEST: 'The request is missing something it needs.',
    INVALID_FLOW_ID: 'That flow ID is not valid.',
    NOT_FOUND: 'That was not found.',
    FORBIDDEN: 'You are not allowed to do that.',
    AUTHORIZATION_ERROR: 'Could not check whether you are allowed to do that.',
    CONFIGURATION_ERROR: 'The server is not configured correctly (API key or sender).',
    UPSTREAM_UNREACHABLE: 'Could not reach Infobip.',
    UPSTREAM_ERROR: 'Infobip returned an error (HTTP {status}).',
    UPSTREAM_INVALID_RESPONSE: 'Infobip returned a response the builder could not use.',
    FLOW_STILL_INDEXING: 'The flow was created but Infobip is still indexing it. Try saving again in a few seconds.',
    DOWNLOAD_URL_MISSING: 'Infobip did not provide a download link for the flow.',
    DOWNLOAD_URL_INVALID: 'The flow download link is not valid.',
    DOWNLOAD_HOST_NOT_ALLOWED: 'The flow download link points to a host that is not allowed.',
    DOWNLOAD_TOO_MANY_REDIRECTS: 'The flow download was redirected too many times.',
    INTERNAL_ERROR: 'The server hit an unexpected error.',
  },
};
