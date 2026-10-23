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
import { FlowBuilderApp } from '../app/FlowBuilderApp';
import { FlowBuilderErrorBoundary } from '../app/ErrorBoundary';
import {
  FlowBuilderProvider as InternalProvider,
  type FlowBuilderProviderConfig,
} from '../app/FlowBuilderProvider';

/** Everything the builder can be configured with. */
export type FlowBuilderProps = FlowBuilderProviderConfig;

/** Props of `<FlowBuilderProvider>`: the same configuration, plus children. */
export type FlowBuilderProviderProps = FlowBuilderProps & { children?: React.ReactNode };

/**
 * Holds the builder's configuration (API access, theme, brand, features,
 * routing, storage, callbacks) for the pieces rendered inside it:
 * `<FlowLibrary>`, `<FlowEditor>`, `<FlowPreview>` or `<FlowBuilder>` itself.
 * It renders no UI of its own; each piece renders its own themed root.
 *
 * Embed defaults: `routing="memory"` (the host page's URL is never touched)
 * and `layout="fill"` (the builder fills a container the host sizes). Pass
 * `routing="hash"` / `layout="page"` for a standalone page.
 */
export function FlowBuilderProvider({ routing = 'memory', layout = 'fill', ...props }: FlowBuilderProviderProps) {
  return <InternalProvider routing={routing} layout={layout} {...props} />;
}

/**
 * The complete builder: provider, error boundary, navigation and pages. A
 * render crash shows an in-place error panel and calls `onError`; it never
 * unmounts the host page.
 *
 * Same embed defaults as `FlowBuilderProvider`: `routing="memory"`,
 * `layout="fill"`. Requires the builder's stylesheet on the page.
 */
export function FlowBuilder({ routing = 'memory', layout = 'fill', ...props }: FlowBuilderProps) {
  return (
    <InternalProvider routing={routing} layout={layout} {...props}>
      <FlowBuilderErrorBoundary>
        <FlowBuilderApp />
      </FlowBuilderErrorBoundary>
    </InternalProvider>
  );
}
