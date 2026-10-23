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

// ── WhatsApp Flow Preview · public surface ──────────────────────────────────
//
// The client-side Flow JSON renderer: a self-contained module that turns Flow
// documents into a WhatsApp-styled surface, optionally wrapped in phone chrome.
// Import from here rather than reaching into the internal file layout.

export { WhatsAppFlowPreview } from './renderer/WhatsAppFlowPreview';
export { PhoneFrame } from './renderer/PhoneFrame';
export type { PhoneFrameProps } from './renderer/PhoneFrame';

export {
  normalizeFlowDocument,
  pickScreen,
  collectRenderableChildren,
} from './renderer/selectScreen';
export type { ScreenContent } from './renderer/selectScreen';

export type {
  FlowDocument,
  FlowScreen,
  FlowComponentNode,
  FlowDataSourceItem,
  WhatsAppFlowPreviewProps,
  PreviewRenderContext,
} from './types';
