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

// Library data hook: loads flows through the reused service layer, keeps in
// sync with the cross-controller flow bus, and exposes optimistic delete /
// publish actions. The library must NOT touch the preview API — live preview is
// an editor-only concern (see services/flowPreview.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteFlow,
  getFlows,
  publishFlow,
  type ManagedFlow,
} from '../../services/whatsappFlows';
import { useT } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';
import { useApiConfig } from '../app/apiConfig';
import { useFlowSyncBus } from '../app/instanceContext';

export type LibraryState = {
  flows: ManagedFlow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  remove: (id: string) => Promise<void>;
  publish: (id: string) => Promise<void>;
};

function toSyncFlow(flow: ManagedFlow) {
  return {
    id: flow.id,
    name: flow.name,
    status: flow.status,
    categories: flow.categories,
    updatedAt: flow.updatedAt ?? null,
  };
}

export function useLibrary(): LibraryState {
  const api = useApiConfig();
  // Read through a ref so a new catalogue object from the host never refetches the list.
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const syncBus = useFlowSyncBus();
  const [flows, setFlows] = useState<ManagedFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadControllerRef = useRef<AbortController | null>(null);
  // Ids of flows we just deleted. The backend list (GET /flows) is eventually
  // consistent: right after a successful DELETE it may still return the flow, so a
  // reload would flicker it back. We filter these out of any refetch result until
  // the backend stops returning them, then drop the tombstone.
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const reload = useCallback(() => {
    reloadControllerRef.current?.abort();
    const controller = new AbortController();
    reloadControllerRef.current = controller;
    setLoading(true);
    setError(null);
    getFlows({ ...api, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const tombstones = deletedIdsRef.current;
        if (tombstones.size > 0) {
          const returnedIds = new Set(result.map((flow) => flow.id));
          // The backend has caught up on these deletes — stop tracking them.
          for (const id of Array.from(tombstones)) {
            if (!returnedIds.has(id)) tombstones.delete(id);
          }
        }
        setFlows(tombstones.size > 0 ? result.filter((flow) => !tombstones.has(flow.id)) : result);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(describeError(tRef.current, err, 'library.errors.loadFailed'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [api]);

  useEffect(() => {
    reload();
    return () => reloadControllerRef.current?.abort();
  }, [reload]);

  // Stay in sync with creates/updates/deletes broadcast by any other mounted
  // controller of this builder instance.
  useEffect(
    () =>
      syncBus.subscribe((event) => {
        // Honor deletes from other controllers (e.g. the editor) so a lagging
        // backend list doesn't resurrect the flow in this library.
        if (event.type === 'deleted') deletedIdsRef.current.add(event.id);
        reload();
      }),
    [reload, syncBus],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteFlow(id, api);
      } catch (err) {
        // The backend refused the delete (e.g. the flow is no longer DRAFT).
        // Refresh so a card built from a stale status stops offering an action
        // the backend will reject, then surface the error to the caller.
        reload();
        throw err;
      }
      deletedIdsRef.current.add(id);
      setFlows((current) => current.filter((flow) => flow.id !== id));
      syncBus.publish({ type: 'deleted', id });
      reload();
    },
    [api, reload, syncBus],
  );

  const publish = useCallback(
    async (id: string) => {
      try {
        await publishFlow(id, api);
      } catch (err) {
        // Same stale-status guard as delete: re-sync the list on rejection so
        // an already-published flow stops offering Publish.
        reload();
        throw err;
      }
      const updatedFlow = flows.find((flow) => flow.id === id);
      setFlows((current) =>
        current.map((flow) => (flow.id === id ? { ...flow, status: 'PUBLISHED' } : flow)),
      );
      if (updatedFlow) {
        syncBus.publish({ type: 'published', flow: { ...toSyncFlow(updatedFlow), status: 'PUBLISHED' } });
      }
      reload();
    },
    [api, flows, reload, syncBus],
  );

  return { flows, loading, error, reload, remove, publish };
}
