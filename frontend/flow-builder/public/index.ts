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

// ── Public entry ───────────────────────────────────────────────────────────
//
// The only module a host imports. Everything under `app/`, `pages/`,
// `features/` and the rest stays internal.

export { FlowBuilder, FlowBuilderProvider } from './FlowBuilder';
export type { FlowBuilderProps, FlowBuilderProviderProps } from './FlowBuilder';
export { FlowLibrary, FlowEditor, FlowPreview } from './pieces';
export type { FlowLibraryProps, FlowEditorProps, FlowPreviewProps } from './pieces';

export type {
  FlowBuilderBrand,
  FlowBuilderErrorSource,
  FlowBuilderEvents,
  FlowBuilderFeatures,
  FlowBuilderFlowSummary,
  FlowBuilderTheme,
  FlowBuilderThemeMode,
} from '../app/hostConfig';
export type { FlowBuilderThemeTokens } from '../styles/themeTokens';
export type { BrandName as FlowBuilderPreset } from '../styles/tokens';
export type { FlowBuilderApiConfig } from '../app/apiConfig';
export type { FlowBuilderInstanceOptions, FlowBuilderLayout, FlowBuilderRouting } from '../app/instanceContext';

export { createHashRouter, createMemoryRouter } from '../utils/routing';
export type { EditorMode, NavigateOptions, Route, Router } from '../utils/routing';
export { createLocalStorageAdapter, createMemoryStorageAdapter } from '../services/storage';
export type { StorageAdapter } from '../services/storage';
export { FlowBuilderApiError } from '../../api';
export type { FlowBuilderMessages, FlowBuilderMessagesOverride } from '../i18n/messages';
export type { FlowBuilderI18nOptions } from '../i18n/I18nProvider';
