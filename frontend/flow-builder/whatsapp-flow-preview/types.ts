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

// ── WhatsApp Flow Preview · type surface ────────────────────────────────────
//
// Self-contained, UI-agnostic types for the client-side Flow JSON renderer.
// These describe the *shape of the JSON we render*, not the stricter Flow JSON
// types in `src/types/*` that the validator works on. The renderer must survive partial / hand-written /
// future-spec JSON, so every field is permissive and property access is
// defensive — the goal is "render what we can, fall back gracefully" rather
// than "reject anything non-conforming".
//
// Nothing here imports from the rest of the app: the module owns its own type
// vocabulary so it can be lifted out and reused unchanged.

/** A generic Flow component node. `type` drives the registry dispatch; every
 *  other property is component-specific and read defensively at render time. */
export interface FlowComponentNode {
  type: string;
  // Common optional fields across many components (kept loose on purpose).
  name?: string;
  text?: string;
  label?: string;
  required?: boolean;
  visible?: boolean | string;
  enabled?: boolean | string;
  children?: FlowComponentNode[];
  [key: string]: unknown;
}

/** A single screen-data field descriptor: `{ type, __example__ }`. */
export interface ScreenDataField {
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | string;
  __example__?: unknown;
  [key: string]: unknown;
}

/** The top-level layout container of a screen (usually SingleColumnLayout). */
export interface FlowScreenLayout {
  type?: string;
  children?: FlowComponentNode[];
  [key: string]: unknown;
}

/** A single Flow screen. */
export interface FlowScreen {
  id: string;
  title?: string;
  terminal?: boolean;
  success?: boolean;
  data?: Record<string, ScreenDataField | unknown>;
  layout?: FlowScreenLayout;
  [key: string]: unknown;
}

/** A whole Flow document. Permissive — only `screens` is truly required. */
export interface FlowDocument {
  version?: string;
  screens?: FlowScreen[];
  [key: string]: unknown;
}

/** Selection / choice option used by Dropdown, Radio, Checkbox, Chips, etc. */
export interface FlowDataSourceItem {
  id: string;
  title?: string;
  description?: string;
  enabled?: boolean;
  metadata?: string;
  'alt-text'?: string;
  image?: string;
  [key: string]: unknown;
}

/** Runtime data bag: `${data.field}` reads from here, falling back to a
 *  screen's `__example__` values when a key is absent. */
export type FlowRuntimeData = Record<string, unknown>;

/** Form-value bag: `${form.field}` reads from here. Seeds field previews and
 *  the interactive-mode required/disabled Footer computation. */
export type FlowFormValues = Record<string, unknown>;

/** Props for the public `WhatsAppFlowPreview` component. */
export interface WhatsAppFlowPreviewProps {
  /** The Flow JSON to render. Accepts an object or a raw JSON string. */
  flowJson: FlowDocument | string | null | undefined;
  /** Which screen to render. Defaults to the first screen when omitted. */
  screenId?: string;
  /** Unscaled surface width in px (default 360). */
  width?: number;
  /** Unscaled surface height in px (default 640). */
  height?: number;
  /** CSS transform scale applied to the whole surface (default 1). The outer
   *  box reserves `width*scale × height*scale` so no empty layout space leaks. */
  scale?: number;
  /** When false (default), the surface is inert: no active inputs, no hover,
   *  no accidental navigation — ideal for catalogue thumbnails. */
  interactive?: boolean;
  /** Runtime data used to resolve `${data.field}` and dynamic `data-source`. */
  data?: FlowRuntimeData;
  /** Initial form values used to resolve `${form.field}` and to compute the
   *  interactive-mode Footer disabled state from required-but-empty fields. */
  initialValues?: FlowFormValues;
  /** Optional extra class on the outer (scaled) box. */
  className?: string;
  /** Optional accessible label for the whole preview surface. */
  ariaLabel?: string;
}

/** Everything a component renderer needs to resolve templates / conditions.
 *  Deliberately immutable data + pure helpers — renderers never mutate it. */
export interface PreviewRenderContext {
  /** Effective data bag = runtime `data` overlaid on screen `__example__`. */
  readonly data: FlowRuntimeData;
  /** Effective form values. */
  readonly form: FlowFormValues;
  /** Whether the preview is interactive (affects Footer disabled + affordances). */
  readonly interactive: boolean;
  /** The screen currently being rendered. */
  readonly screen: FlowScreen;
}
