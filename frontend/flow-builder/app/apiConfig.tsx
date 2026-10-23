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

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import type { ApiOptions } from '../../api';
import { useHostConfig } from './hostConfig';

/**
 * The request settings a host passes in. `signal` stays per call, and
 * `onError` is internal: failures reach the host's own `onError` prop.
 */
export type FlowBuilderApiConfig = Omit<ApiOptions, 'signal' | 'onError'>;

// Makes the shared `ApiOptions` (base URL, headers, fetch, credentials,
// unauthorized hook) available to every hook without prop drilling.
const ApiConfigContext = createContext<ApiOptions>({});

export function ApiConfigProvider({
  apiBaseUrl,
  getHeaders,
  fetch,
  credentials,
  onUnauthorized,
  children,
}: FlowBuilderApiConfig & { children: React.ReactNode }) {
  // Failed calls reach the host's `onError` through the live `events` ref, so
  // a host that swaps its callback doesn't rebuild the options.
  const { events } = useHostConfig();
  const onError = useCallback((error: unknown) => {
    events.current?.onError?.(error, { source: 'api' });
  }, [events]);
  const value = useMemo<ApiOptions>(
    () => ({ apiBaseUrl, getHeaders, fetch, credentials, onUnauthorized, onError }),
    [apiBaseUrl, getHeaders, fetch, credentials, onUnauthorized, onError],
  );
  return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>;
}

export function useApiConfig(): ApiOptions {
  return useContext(ApiConfigContext);
}
