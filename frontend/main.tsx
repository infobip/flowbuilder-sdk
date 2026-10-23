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
import { createRoot } from 'react-dom/client';
import { FlowBuilderEntry } from './flow-builder/app/FlowBuilderEntry';
import { BRAND_ICONS } from './flow-builder/components/theme/brand';
import type { BrandName } from './flow-builder/styles/tokens';

// The standalone host. Unlike an embedding page, it owns the whole document:
// the route lives in the URL hash, the builder grows with the window, and the
// builder's page title and brand icon are written to the document here — the
// builder itself never touches anything outside its root element.

// Pages without a title of their own (library, settings) show the one the
// page loaded with.
const defaultTitle = document.title;

function setDocumentTitle(title: string | null): void {
  document.title = title ?? defaultTitle;
}

// The tab icon lives in index.html's <head>, outside the React tree.
function setFavicon(brand: BrandName): void {
  const icon = BRAND_ICONS[brand];
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')) {
    if (link.getAttribute('href') !== icon) link.setAttribute('href', icon);
  }
}

const root = document.getElementById('app');
if (root) {
  createRoot(root).render(
    <FlowBuilderEntry
      apiBaseUrl={document.body.dataset.apiBaseUrl || undefined}
      routing="hash"
      layout="page"
      features={{ apiKeySettings: true }}
      onTitleChange={setDocumentTitle}
      onBrandChange={setFavicon}
    />,
  );
}
