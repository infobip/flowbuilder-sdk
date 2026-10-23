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

import React from 'react';
import { ThemeProvider } from '../components/theme/ThemeProvider';
import { I18nProvider, type FlowBuilderI18nOptions } from '../i18n/I18nProvider';
import type { BrandName } from '../styles/tokens';
import { ApiConfigProvider, type FlowBuilderApiConfig } from './apiConfig';
import { HostConfigProvider, type FlowBuilderHostOptions } from './hostConfig';
import { InstanceProvider, type FlowBuilderInstanceOptions } from './instanceContext';

export type FlowBuilderProviderConfig = FlowBuilderInstanceOptions &
  FlowBuilderApiConfig &
  FlowBuilderHostOptions &
  FlowBuilderI18nOptions & {
    /** Called with the active brand on mount and on change (the standalone host sets the favicon from it). */
    onBrandChange?: (brand: BrandName) => void;
  };

// Holds the builder's configuration and renders no UI of its own. It creates
// the per-instance context (router, storage, caches, host callbacks), the
// i18n context (locale, messages), the host
// configuration (theme, brand slots, features, lifecycle events) and the theme
// + API config providers. The surfaces (the full app, or one of the composable
// pieces) render the themed root themselves.
//
// Defaults here reproduce the standalone app: hash routing, localStorage under
// the `flowbuilder` namespace, layout "page". The public wrappers in
// `public/` apply embed defaults instead.
export function FlowBuilderProvider({
  apiBaseUrl,
  getHeaders,
  fetch,
  credentials,
  onUnauthorized,
  theme,
  brand,
  features,
  onFlowCreated,
  onFlowSaved,
  onFlowPublished,
  onFlowDeleted,
  onError,
  onBrandChange,
  locale,
  messages,
  children,
  ...instance
}: FlowBuilderProviderConfig & { children?: React.ReactNode }) {
  return (
    <InstanceProvider {...instance}>
      <I18nProvider locale={locale} messages={messages}>
        <HostConfigProvider
          theme={theme}
          brand={brand}
          features={features}
          onFlowCreated={onFlowCreated}
          onFlowSaved={onFlowSaved}
          onFlowPublished={onFlowPublished}
          onFlowDeleted={onFlowDeleted}
          onError={onError}
        >
          <ThemeProvider onBrandChange={onBrandChange}>
            <ApiConfigProvider
              apiBaseUrl={apiBaseUrl}
              getHeaders={getHeaders}
              fetch={fetch}
              credentials={credentials}
              onUnauthorized={onUnauthorized}
            >
              {children}
            </ApiConfigProvider>
          </ThemeProvider>
        </HostConfigProvider>
      </I18nProvider>
    </InstanceProvider>
  );
}
