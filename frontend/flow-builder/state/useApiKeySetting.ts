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

// API key hook for the settings page. Reads which credential the proxy is
// using and swaps it for another one. The key itself is write-only from here:
// the server verifies a candidate before adopting it and never sends it back,
// so all this state holds is the source and the last four characters.

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearApiKey, getApiKeyStatus, setApiKey, type ApiKeyStatus } from '../services/apiKey';
import { describeError } from '../i18n/errors';
import { useT } from '../i18n/I18nProvider';
import { useApiConfig } from '../app/apiConfig';
import { useFlowJsonCache } from '../app/instanceContext';

/** Outcome of the last save/reset, shown as one line under the field. */
export type ApiKeyResult = { tone: 'info' | 'error'; text: string };

/**
 * Which action is in flight. Both lock every control, but each button needs to
 * describe only its own work — a reset should not make Save claim it is
 * checking a key.
 */
export type ApiKeyPending = 'save' | 'reset' | null;

export type ApiKeySettingState = {
  status: ApiKeyStatus | null;
  loading: boolean;
  pending: ApiKeyPending;
  result: ApiKeyResult | null;
  /** Resolves true when the key was accepted, so the caller can clear the field. */
  save: (apiKey: string) => Promise<boolean>;
  reset: () => Promise<void>;
};

export function useApiKeySetting(): ApiKeySettingState {
  const api = useApiConfig();
  const t = useT();
  const flowJsonCache = useFlowJsonCache();
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<ApiKeyPending>(null);
  const [result, setResult] = useState<ApiKeyResult | null>(null);
  const loadRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current = controller;
    setLoading(true);
    getApiKeyStatus({ ...api, signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) setStatus(next);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setResult({ tone: 'error', text: describeError(t, err, 'settings.apiKey.errors.load') });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, t]);

  // The form is usable before the initial read lands, so a slow GET could
  // otherwise resolve after a save and overwrite the new status with the old.
  const begin = useCallback((next: Exclude<ApiKeyPending, null>) => {
    loadRef.current?.abort();
    setLoading(false);
    setPending(next);
    setResult(null);
  }, []);

  const save = useCallback(
    async (apiKey: string) => {
      begin('save');
      try {
        setStatus(await setApiKey(apiKey, api, flowJsonCache.clear));
        setResult({ tone: 'info', text: t('settings.apiKey.results.saved') });
        return true;
      } catch (err) {
        setResult({ tone: 'error', text: describeError(t, err, 'settings.apiKey.errors.save') });
        return false;
      } finally {
        setPending(null);
      }
    },
    [api, begin, flowJsonCache, t],
  );

  const reset = useCallback(async () => {
    begin('reset');
    try {
      setStatus(await clearApiKey(api, flowJsonCache.clear));
      setResult({ tone: 'info', text: t('settings.apiKey.results.reset') });
    } catch (err) {
      setResult({ tone: 'error', text: describeError(t, err, 'settings.apiKey.errors.reset') });
    } finally {
      setPending(null);
    }
  }, [api, begin, flowJsonCache, t]);

  return { status, loading, pending, result, save, reset };
}
