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
import type { Route } from '../utils/routing';
import { LibraryPage } from '../pages/LibraryPage';
import { EditorPage } from '../pages/EditorPage';
import { PreviewPage } from '../pages/PreviewPage';
import { useFeatures } from './hostConfig';
import { SettingsPage } from '../pages/SettingsPage';

// Maps the typed Route onto a page. The router owns no layout — the shell wraps
// this with the navigation rail.
//
// The return type is annotated so a new Route variant without a case here is a
// compile error rather than a blank screen.
export function FlowBuilderRouter({ route }: { route: Route }): React.ReactElement {
  const features = useFeatures();
  switch (route.name) {
    case 'library':
      return <LibraryPage />;
    case 'settings':
      // With Settings off, a stale #/settings link shows the library rather
      // than navigating mid-render; the rail has no Settings item to mark.
      return features.settings ? <SettingsPage /> : <LibraryPage />;
    case 'flow-new':
      return <EditorPage flowId={null} mode={route.mode} />;
    case 'flow-edit':
      return <EditorPage flowId={route.flowId} mode={route.mode} />;
    case 'flow-preview':
      return <PreviewPage flowId={route.flowId} />;
  }
}
