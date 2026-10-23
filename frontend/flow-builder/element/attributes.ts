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

// Pure mapping from the element's attributes and properties to the props of
// the React component. No DOM here, so it runs under node:test.

import React from 'react';
import { BRANDS, type BrandName } from '../styles/tokens';
import type { FlowBuilderBrand, FlowBuilderFeatures, FlowBuilderTheme, FlowBuilderThemeMode } from '../app/hostConfig';
import type { FlowBuilderProps } from './flowBuilder';

export const OBSERVED_ATTRIBUTES = ['api-base-url', 'theme-mode', 'preset', 'locale', 'routing', 'layout', 'storage-key', 'fonts'] as const;
export type ObservedAttribute = (typeof OBSERVED_ATTRIBUTES)[number];
export type ElementAttributes = Partial<Record<ObservedAttribute, string | null>>;

/** What an element's brand property takes: the logo is a URL, never markup. */
export type ElementBrand = Omit<FlowBuilderBrand, 'logo'> & {
  /** An image URL (http(s), relative, or a `data:image/` URI) shown instead of the default lockup. */
  logo?: string;
};

export type ElementProperties = {
  theme?: FlowBuilderTheme;
  brand?: ElementBrand;
  features?: FlowBuilderFeatures;
  /** Overrides for any messages; anything missing falls back to English. */
  messages?: FlowBuilderProps['messages'];
  getHeaders?: FlowBuilderProps['getHeaders'];
  fetch?: FlowBuilderProps['fetch'];
};

const THEME_MODES: readonly string[] = ['light', 'dark', 'system'];

export function parseThemeMode(value: string | null | undefined): FlowBuilderThemeMode | undefined {
  return value != null && THEME_MODES.includes(value) ? (value as FlowBuilderThemeMode) : undefined;
}

export function parsePreset(value: string | null | undefined): BrandName | undefined {
  return value != null && (BRANDS as readonly string[]).includes(value) ? (value as BrandName) : undefined;
}

/** An embedded builder defaults to in-memory routing; anything but `hash` is memory. */
export function parseRouting(value: string | null | undefined): 'memory' | 'hash' {
  return value === 'hash' ? 'hash' : 'memory';
}

/** An embedded builder defaults to filling its container. */
export function parseLayout(value: string | null | undefined): 'fill' | 'page' {
  return value === 'page' ? 'page' : 'fill';
}

/** `fonts="none"` opts out of the document-level @font-face injection. */
export function wantsFonts(value: string | null | undefined): boolean {
  return value !== 'none';
}

/**
 * Logo URLs are rendered through `<img src>`, which never runs script, but
 * `javascript:` and friends are still refused: only http(s), protocol-relative
 * or relative URLs, and `data:image/` URIs pass.
 */
export function isSafeImageUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (/^data:image\//i.test(value)) return true;
  // Anything with a scheme other than http(s) is refused.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return scheme ? /^https?$/i.test(scheme[1]) : true;
}

function resolveBrand(brand: ElementBrand | undefined): FlowBuilderBrand | undefined {
  if (!brand) return undefined;
  const { logo, ...rest } = brand;
  if (typeof logo !== 'string' || !isSafeImageUrl(logo)) return rest;
  return {
    ...rest,
    logo: React.createElement('img', {
      src: logo.trim(),
      alt: brand.productName ?? '',
      style: { display: 'block', height: '28px', width: 'auto' },
    }),
  };
}

// The attributes are the simple way to set the theme; the `theme` property is
// the rich one, and a field it sets wins over the matching attribute.
function resolveTheme(attrs: ElementAttributes, theme: FlowBuilderTheme | undefined): FlowBuilderTheme | undefined {
  const mode = theme?.mode ?? parseThemeMode(attrs['theme-mode']);
  const preset = theme?.preset ?? parsePreset(attrs.preset);
  if (mode === undefined && preset === undefined && !theme) return undefined;
  return { ...theme, ...(mode !== undefined && { mode }), ...(preset !== undefined && { preset }) };
}

/** Everything the React component needs, from the current attributes, properties and event callbacks. */
export function buildElementProps(
  attrs: ElementAttributes,
  properties: ElementProperties,
  callbacks: Pick<FlowBuilderProps, 'onFlowCreated' | 'onFlowSaved' | 'onFlowPublished' | 'onFlowDeleted' | 'onError' | 'onNavigate'>,
): FlowBuilderProps {
  return {
    apiBaseUrl: attrs['api-base-url'] || undefined,
    routing: parseRouting(attrs.routing),
    layout: parseLayout(attrs.layout),
    storageKey: attrs['storage-key'] || undefined,
    theme: resolveTheme(attrs, properties.theme),
    brand: resolveBrand(properties.brand),
    features: properties.features,
    locale: attrs.locale || undefined,
    messages: properties.messages,
    getHeaders: properties.getHeaders,
    fetch: properties.fetch,
    ...callbacks,
  };
}
