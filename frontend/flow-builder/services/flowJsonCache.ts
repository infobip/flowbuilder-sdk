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

// ── Flow JSON cache ─────────────────────────────────────────────────────────
//
// Library cards render a live phone-frame preview of each flow's first screen,
// which means fetching the flow's JSON definition. Metadata (`ManagedFlow`) does
// not carry the JSON, so we fetch it lazily per card via `downloadFlowJson`.
//
// To keep the library from re-fetching the same document every time a card
// mounts (pagination, tab switches, re-renders), each flow's JSON is fetched at
// most once per cache and memoised as an in-flight promise. Failures resolve
// to `null` so a card degrades to a neutral placeholder rather than throwing.
//
// Each builder instance creates its own cache (app/instanceContext.tsx): two
// builders on one page may talk to different backends or accounts, so a flow
// id alone is not a safe key across them.

import type { ApiOptions } from '../../api';
import { downloadFlowJson } from '../../services/whatsappFlows';
import { normalizeFlowDocument, type FlowDocument } from '../whatsapp-flow-preview';

export type FlowJsonCache = {
  /** Get a flow's JSON document, fetching (and caching) it on first request. */
  get(flowId: string, options?: ApiOptions): Promise<FlowDocument | null>;
  /** Clear the whole cache (e.g. after a credential change). */
  clear(): void;
};

async function fetchFlowDocument(flowId: string, options?: ApiOptions): Promise<FlowDocument | null> {
  try {
    const raw = await downloadFlowJson(flowId, options);
    return normalizeFlowDocument(raw);
  } catch {
    // Network / auth / shape failures all degrade to a placeholder preview.
    return null;
  }
}

export function createFlowJsonCache(): FlowJsonCache {
  // flowId → resolved (or in-flight) document. `null` = fetched but unusable.
  const cache = new Map<string, Promise<FlowDocument | null>>();
  return {
    get(flowId, options) {
      const existing = cache.get(flowId);
      if (existing) return existing;
      const pending = fetchFlowDocument(flowId, options);
      cache.set(flowId, pending);
      // If the fetch resolved to null, drop it so a later mount can retry once.
      pending.then((doc) => {
        if (doc == null && cache.get(flowId) === pending) cache.delete(flowId);
      });
      return pending;
    },
    clear() {
      cache.clear();
    },
  };
}
