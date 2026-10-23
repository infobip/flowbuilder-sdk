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

// ── Flow Builder flow-loading helpers ──────────────────────────────────────
//
// Shared retry policy for loading an existing flow into the editor. Infobip can
// briefly return 404s for flows that were just created or updated, so the editor
// retries the metadata + JSON load together before surfacing an error.

import { delay } from '../../api';

export const FLOW_LOAD_RETRY_DELAYS = [1000, 2000, 4000] as const;

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isTransientFlowLoadError(error: unknown): boolean {
  const message = toMessage(error, '').toLowerCase();
  return (
    message.includes('404')
    || message.includes('not found')
    || message.includes('requested url not found')
    || message.includes('expired')
  );
}

export async function retryTransientFlowLoad<T>(loader: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= FLOW_LOAD_RETRY_DELAYS.length; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      if (attempt >= FLOW_LOAD_RETRY_DELAYS.length || !isTransientFlowLoadError(error)) {
        throw error;
      }
      await delay(FLOW_LOAD_RETRY_DELAYS[attempt]);
    }
  }

  throw new Error('Unable to load flow.');
}
