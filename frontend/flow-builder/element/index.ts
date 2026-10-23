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

// Entry for the web component build (dist/element/index.js, and
// standalone.js with React inlined).
//
// CSS delivery: this build bundles the compiled stylesheet as a string
// (`frontend/app.css`, so `npm run build:frontend` must run first; the
// `build:element` script does) and the element adopts it into each shadow
// root. A host that serves its own copy, say the package's styles.css, calls
// `FlowBuilderElement.setStyles(cssTextOrSheet)` instead.

import { FlowBuilderElement } from './FlowBuilderElement';
import compiledCss from './compiledCss';

FlowBuilderElement.setBundledStyles(compiledCss);

export { FlowBuilderElement };
export { ELEMENT_EVENTS, type ElementEventName } from './events';
export type { ElementBrand, ElementProperties } from './attributes';

let baseRegistered = false;

/** Register the custom element. Safe to call more than once; returns the class registered under the name. */
export function defineFlowBuilderElement(tagName = 'infobip-flow-builder'): CustomElementConstructor {
  const existing = customElements.get(tagName);
  if (existing) return existing;
  // A constructor can be registered once, so further names get a subclass.
  const ctor = baseRegistered ? class extends FlowBuilderElement {} : FlowBuilderElement;
  baseRegistered = true;
  customElements.define(tagName, ctor);
  return ctor;
}
