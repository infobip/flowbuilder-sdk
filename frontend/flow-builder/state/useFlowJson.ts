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

// ── useFlowJson ─────────────────────────────────────────────────────────────
//
// Card-level hook that resolves a flow's JSON document for the phone-frame
// preview. Backed by the builder instance's flow JSON cache (fetch-once per
// instance) and the ambient API config, so a card just asks for `flowId` and gets `{ doc, loading }`.
//
// Only cards that actually mount call this, so the library fetches JSON for the
// visible page only. The effect is abortable: if the flow id changes or the
// card unmounts before the fetch settles, the stale result is ignored.

import { useEffect, useState } from 'react';
import type { FlowDocument } from '../whatsapp-flow-preview';
import { useApiConfig } from '../app/apiConfig';
import { useFlowJsonCache } from '../app/instanceContext';

export type FlowJsonState = {
  doc: FlowDocument | null;
  loading: boolean;
};

export function useFlowJson(flowId: string | null | undefined): FlowJsonState {
  const api = useApiConfig();
  const cache = useFlowJsonCache();
  const [state, setState] = useState<FlowJsonState>({ doc: null, loading: Boolean(flowId) });

  useEffect(() => {
    if (!flowId) {
      setState({ doc: null, loading: false });
      return;
    }

    let active = true;
    setState({ doc: null, loading: true });

    cache.get(flowId, api).then((doc) => {
      if (active) setState({ doc, loading: false });
    });

    return () => {
      active = false;
    };
  }, [flowId, api, cache]);

  return state;
}
