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

// Loads the live preview iframe for a single flow. Used by the read-only
// preview page for published flows.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiConfig } from '../app/apiConfig';
import { useT } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';
import { fetchFlowPreview, IDLE_PREVIEW, type FlowPreviewState } from '../services/flowPreview';

export type FlowPreviewHookState = {
  preview: FlowPreviewState;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useFlowPreview(flowId: string): FlowPreviewHookState {
  const api = useApiConfig();
  const t = useT();
  const [preview, setPreview] = useState<FlowPreviewState>(IDLE_PREVIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    setPreview({ ...IDLE_PREVIEW, status: 'loading' });

    void fetchFlowPreview(flowId, { ...api, signal: controller.signal }, t)
      .then((result) => {
        if (controller.signal.aborted) return;
        clearObjectUrl();
        if (result.kind === 'image' && result.url.startsWith('blob:')) {
          objectUrlRef.current = result.url;
        }
        setPreview(result);
        if (result.status === 'error' || result.status === 'unavailable') {
          setError(result.error ?? t('preview.errors.unavailable'));
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(describeError(t, err, 'preview.errors.loadFailed'));
          setPreview(IDLE_PREVIEW);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [api, clearObjectUrl, flowId, t]);

  useEffect(() => {
    reload();
    return () => {
      controllerRef.current?.abort();
      clearObjectUrl();
    };
  }, [clearObjectUrl, reload]);

  return { preview, loading, error, reload };
}
