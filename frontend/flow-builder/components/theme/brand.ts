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

import type { MessageKey } from '../../i18n/messages';
import { BRANDS, type BrandName } from '../../styles/tokens';

export const DEFAULT_BRAND: BrandName = 'default';

/** A stored brand, or the default look for anything unrecognised. */
export function parseBrand(value: string | null | undefined): BrandName {
  return BRANDS.find((brand) => brand === value) ?? DEFAULT_BRAND;
}

/** The message key for what Settings calls each brand (proper nouns a host may rename). */
export const BRAND_LABEL_KEYS: Record<BrandName, MessageKey> = {
  default: 'settings.appearance.brand.names.default',
};

/**
 * The browser-tab icon for each brand, as server.js serves it. Applied by the
 * standalone host (frontend/main.tsx), never by the builder itself.
 */
export const BRAND_ICONS: Record<BrandName, string> = {
  default: '/frontend/assets/sparkle-mark.svg',
};
