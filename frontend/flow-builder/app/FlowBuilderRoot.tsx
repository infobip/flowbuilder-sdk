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

import React, { useMemo } from 'react';
import { useTheme } from '../components/theme/ThemeProvider';
import { useElementHeight } from '../utils/useElementHeight';
import { useInstance } from './instanceContext';

// The themed root element every builder surface renders inside. Marks the
// wrapper with `data-flowbuilder-root`, `data-theme` and `data-brand`:
// styles/theme.css and styles/brands/ switch every variable off those, the
// base layer in styles/app.css gives it the page background and type
// defaults, and dialogs portal into it (via the instance's root ref).
//
// Layout "page" is today's standalone app: one wrapper, the window scrolls.
// Layout "fill" sizes the root from the host's container: the root clips, an
// inner element scrolls (so sticky bars stick inside the builder), and dialogs
// portalled into the root sit over its visible box. The root's measured height
// is published as `--fb-vh`, which every former viewport-height utility reads
// with a `100vh` fallback — so "page" renders exactly as before.
export function FlowBuilderRoot({ children }: { children: React.ReactNode }) {
  const { theme, brand, tokenStyle } = useTheme();
  const { rootRef, layout } = useInstance();
  const fill = layout === 'fill';
  const rootHeight = useElementHeight(rootRef, fill);
  // The host's token overrides (set through CSSOM, so CSP-safe) plus `--fb-vh`.
  const style = useMemo(() => {
    const merged: Record<string, string> = { ...tokenStyle };
    if (fill && rootHeight != null) merged['--fb-vh'] = `${rootHeight}px`;
    return Object.keys(merged).length > 0 ? (merged as React.CSSProperties) : undefined;
  }, [tokenStyle, fill, rootHeight]);

  return (
    <div
      ref={rootRef}
      data-flowbuilder-root=""
      data-theme={theme}
      data-brand={brand}
      data-layout={layout}
      style={style}
    >
      {/* `data-fb-frame` is an inline-block, which stops a host's
          text-decoration being drawn through the builder (styles/isolation.css). */}
      {fill ? (
        <div data-fb-frame="" data-fb-scroll="" className="h-full w-full overflow-auto">
          {children}
        </div>
      ) : (
        <div data-fb-frame="">{children}</div>
      )}
    </div>
  );
}
