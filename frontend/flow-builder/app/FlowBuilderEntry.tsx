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
import { FlowBuilderApp } from './FlowBuilderApp';
import { FlowBuilderErrorBoundary } from './ErrorBoundary';
import { FlowBuilderProvider, type FlowBuilderProviderConfig } from './FlowBuilderProvider';

export type FlowBuilderEntryProps = FlowBuilderProviderConfig;

// The full app: provider + error boundary + themed root, shell and router.
// Styles come from the prebuilt `frontend/app.css` that the host page links.
//
// Defaults reproduce the standalone app (see FlowBuilderProvider). The public
// `<FlowBuilder>` wraps this with embed defaults.
export function FlowBuilderEntry(props: FlowBuilderEntryProps) {
  return (
    <FlowBuilderProvider {...props}>
      <FlowBuilderErrorBoundary>
        <FlowBuilderApp />
      </FlowBuilderErrorBoundary>
    </FlowBuilderProvider>
  );
}
