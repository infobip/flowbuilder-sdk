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

// ── Host configuration ─────────────────────────────────────────────────────
//
// What the embedding page decides about the builder: its theme, the brand
// slots in the chrome, which features are on, and the lifecycle callbacks it
// wants to hear. The standalone host (frontend/main.tsx) is just another host;
// the defaults below reproduce it, except for the API-key settings, which only
// the standalone host turns on (its server is the only one with the endpoint).

import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { FlowSyncFlow } from '../../shared';
import type { BrandName } from '../styles/tokens';
import type { FlowBuilderThemeTokens } from '../styles/themeTokens';
import { useT } from '../i18n/I18nProvider';
import { useFlowSyncBus } from './instanceContext';

export type FlowBuilderThemeMode = 'light' | 'dark' | 'system';

export type FlowBuilderTheme = {
  /**
   * `system` follows the OS. When set, the host owns the mode and the builder's
   * own light/dark switch is hidden unless `features.themeSwitch` is true.
   */
  mode?: FlowBuilderThemeMode;
  /** A built-in look. When set, the Settings brand picker is hidden. */
  preset?: BrandName;
  /**
   * Overrides for the light theme. Theme-independent tokens (fonts, radii,
   * motion) also apply in dark; colour and shadow tokens never do.
   */
  tokens?: FlowBuilderThemeTokens;
  /** Overrides for the dark theme. Dark colours come only from here. */
  darkTokens?: FlowBuilderThemeTokens;
};

export type FlowBuilderBrand = {
  /** Replaces the mark + wordmark lockup at the top of the navigation rail. */
  logo?: React.ReactNode;
  /** Used in the rail's label, page titles and copy. Defaults to the `common.productName` message. */
  productName?: string;
  /** The line under the product name in the default lockup. */
  tagline?: string;
};

export type FlowBuilderFeatures = {
  /** The navigation rail. Default true. */
  navigation?: boolean;
  /** The Settings page (and its rail item). Default true. */
  settings?: boolean;
  /** The light/dark switch. Default true, or false when `theme.mode` is set. */
  themeSwitch?: boolean;
  /** The brand picker in Settings. Default true, or false when `theme.preset` is set. */
  brandPicker?: boolean;
  /** The chat history export/import section in Settings. Default true. */
  chatHistoryBackup?: boolean;
  /**
   * The API-key section in Settings. Default false: it talks to an endpoint
   * only the standalone server has, and changes a process-wide key.
   */
  apiKeySettings?: boolean;
  /** Deleting flows. Default true. */
  delete?: boolean;
  /** Publishing flows. Default true. */
  publish?: boolean;
};

export type ResolvedFlowBuilderFeatures = Required<FlowBuilderFeatures>;

/** The summary of a flow passed to lifecycle callbacks. */
export type FlowBuilderFlowSummary = FlowSyncFlow;

export type FlowBuilderErrorSource = 'render' | 'api';

export type FlowBuilderEvents = {
  onFlowCreated?: (flow: FlowBuilderFlowSummary) => void;
  onFlowSaved?: (flow: FlowBuilderFlowSummary) => void;
  onFlowPublished?: (flow: FlowBuilderFlowSummary) => void;
  onFlowDeleted?: (flowId: string) => void;
  /** A render crash (the builder shows an in-place error) or a failed API call. */
  onError?: (error: unknown, info: { source: FlowBuilderErrorSource }) => void;
};

export type FlowBuilderHostOptions = FlowBuilderEvents & {
  theme?: FlowBuilderTheme;
  brand?: FlowBuilderBrand;
  features?: FlowBuilderFeatures;
};

export type HostConfigValue = {
  theme: FlowBuilderTheme | undefined;
  brand: FlowBuilderBrand;
  productName: string;
  features: ResolvedFlowBuilderFeatures;
  /** Latest host callbacks; read at call time so inline lambdas don't churn context. */
  events: React.RefObject<FlowBuilderEvents>;
};

export function resolveFeatures(features: FlowBuilderFeatures | undefined, theme: FlowBuilderTheme | undefined): ResolvedFlowBuilderFeatures {
  return {
    navigation: features?.navigation ?? true,
    settings: features?.settings ?? true,
    themeSwitch: features?.themeSwitch ?? theme?.mode == null,
    brandPicker: features?.brandPicker ?? theme?.preset == null,
    chatHistoryBackup: features?.chatHistoryBackup ?? true,
    apiKeySettings: features?.apiKeySettings ?? false,
    delete: features?.delete ?? true,
    publish: features?.publish ?? true,
  };
}

const HostConfigContext = createContext<HostConfigValue | null>(null);

export function HostConfigProvider({
  theme,
  brand,
  features,
  onFlowCreated,
  onFlowSaved,
  onFlowPublished,
  onFlowDeleted,
  onError,
  children,
}: FlowBuilderHostOptions & { children: React.ReactNode }) {
  const events = useRef<FlowBuilderEvents>({});
  events.current = { onFlowCreated, onFlowSaved, onFlowPublished, onFlowDeleted, onError };

  // Every create, save, publish and delete is already broadcast on the
  // instance's sync bus, so the host hears exactly what the UI reacts to.
  const syncBus = useFlowSyncBus();
  useEffect(
    () =>
      syncBus.subscribe((event) => {
        const handlers = events.current;
        if (event.type === 'created') handlers.onFlowCreated?.(event.flow);
        else if (event.type === 'updated') handlers.onFlowSaved?.(event.flow);
        else if (event.type === 'published') handlers.onFlowPublished?.(event.flow);
        else handlers.onFlowDeleted?.(event.id);
      }),
    [syncBus],
  );

  const t = useT();
  const defaultProductName = t('common.productName');
  const value = useMemo<HostConfigValue>(
    () => ({
      theme,
      brand: brand ?? {},
      productName: brand?.productName ?? defaultProductName,
      features: resolveFeatures(features, theme),
      events,
    }),
    [theme, brand, features, defaultProductName],
  );

  return <HostConfigContext.Provider value={value}>{children}</HostConfigContext.Provider>;
}

export function useHostConfig(): HostConfigValue {
  const ctx = useContext(HostConfigContext);
  if (!ctx) throw new Error('Flow Builder components must be rendered inside FlowBuilderEntry (HostConfigProvider).');
  return ctx;
}

export function useFeatures(): ResolvedFlowBuilderFeatures {
  return useHostConfig().features;
}
