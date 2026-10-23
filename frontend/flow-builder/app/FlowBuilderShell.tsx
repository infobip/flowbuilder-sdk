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
import { NavigationRail, type NavItem } from '../components/layout/NavigationRail';
import { ThemeSwitch, useTheme } from '../components/theme/ThemeProvider';
import type { BrandName } from '../styles/tokens';
import { useFeatures, useHostConfig } from './hostConfig';
import { visibleNavKeys, type NavKey } from './navItems';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { cx } from '../utils/cx';
import type { Route } from '../utils/routing';
import { useNavigate } from './instanceContext';

// Maps the active route to a top-level nav key.
function activeNavKey(route: Route): NavKey {
  if (route.name === 'library' || route.name === 'flow-preview') return 'library';
  if (route.name === 'settings') return 'settings';
  return 'editor';
}

const NAV_LABEL_KEYS: Record<NavKey, MessageKey> = {
  library: 'common.nav.library',
  editor: 'common.nav.newFlow',
  settings: 'common.nav.settings',
};

const NAV_ICONS: Record<NavKey, React.ReactNode> = {
  library: <span aria-hidden="true">▤</span>,
  editor: <span aria-hidden="true">＋</span>,
  settings: <span aria-hidden="true">⚙</span>,
};

const NAV_ROUTES: Record<NavKey, Route> = {
  library: { name: 'library' },
  editor: { name: 'flow-new', mode: 'prompt' },
  settings: { name: 'settings' },
};

function SparkleMark() {
  return (
    // -mt-px: optical alignment with the wordmark's cap height.
    <svg className="size-6.5 flex-none -mt-px text-nav-active" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.5c.32 3.1 1.22 5.32 2.7 6.8 1.48 1.48 3.7 2.38 6.8 2.7-3.1.32-5.32 1.22-6.8 2.7-1.48 1.48-2.38 3.7-2.7 6.8-.32-3.1-1.22-5.32-2.7-6.8-1.48-1.48-3.7-2.38-6.8-2.7 3.1-.32 5.32-1.22 6.8-2.7 1.48-1.48 2.38-3.7 2.7-6.8Z"
      />
    </svg>
  );
}

// Brand lockup: sparkle mark + wordmark + product scope. Tuned for the graphite
// rail — it reads as white text on dark and would wash out on light surfaces.
type LockupProps = { productName: string; tagline: string };

function BrandLogo({ productName, tagline }: LockupProps) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <SparkleMark />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-15 font-semibold uppercase leading-[1.15] tracking-[0.06em] text-nav-text">{productName}</span>
        {/* Wider than the rail's text column, so it always wraps — balancing
            keeps it two even lines instead of stranding a single word. */}
        <span className="text-11 font-normal leading-[1.3] text-balance text-nav-text-muted">{tagline}</span>
      </span>
    </div>
  );
}

// One lockup per brand, so a new brand without one is a compile error.
const BRAND_LOGOS: Record<BrandName, React.ComponentType<LockupProps>> = {
  default: BrandLogo,
};

// App chrome: navigation rail + content column. The rail's active item carries
// the brand's indicator (styled off aria-current in NavigationRail).
export function FlowBuilderShell({ route, children }: { route: Route; children: React.ReactNode }) {
  const { brand } = useTheme();
  const { brand: hostBrand, productName } = useHostConfig();
  const features = useFeatures();
  const t = useT();
  const Logo = BRAND_LOGOS[brand];
  const navigate = useNavigate();
  const navigation = (
    <NavigationRail
      label={productName}
      // A host logo replaces the whole lockup, whichever brand is active.
      brand={hostBrand.logo ?? <Logo productName={productName} tagline={hostBrand.tagline ?? t('common.tagline')} />}
      items={visibleNavKeys(features).map((key): NavItem => ({ key, label: t(NAV_LABEL_KEYS[key]), icon: NAV_ICONS[key] }))}
      activeKey={activeNavKey(route)}
      onSelect={(key) => navigate(NAV_ROUTES[key as NavKey])}
      footer={
        features.themeSwitch ? (
          <div className="px-2">
            <ThemeSwitch onNav />
          </div>
        ) : undefined
      }
    />
  );

  return (
    // `--fb-vh` is the builder root's height in layout "fill" and unset in
    // "page", where the fallback keeps today's full-viewport min-height.
    <div className={cx('grid min-h-[var(--fb-vh,100vh)] w-full', features.navigation ? 'grid-cols-[auto_1fr]' : 'grid-cols-1')}>
      {features.navigation ? navigation : null}
      <main className="flex min-h-[var(--fb-vh,100vh)] min-w-0 flex-col bg-canvas">{children}</main>
    </div>
  );
}
