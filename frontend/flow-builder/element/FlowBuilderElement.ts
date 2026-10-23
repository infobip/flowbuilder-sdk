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

// The `<infobip-flow-builder>` custom element: a thin DOM shell around the
// React component. It owns an open shadow root, adopts the compiled
// stylesheet into it (constructable CSSStyleSheet, no <style> tags), renders
// the builder with `createRoot` and unmounts on disconnect. Attribute and
// property parsing and the event mapping live in attributes.ts / events.ts.

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  buildElementProps,
  OBSERVED_ATTRIBUTES,
  wantsFonts,
  type ElementAttributes,
  type ElementBrand,
  type ElementProperties,
} from './attributes';
import { createEventCallbacks } from './events';
import { FlowBuilder } from './flowBuilder';
import { buildShadowCss, extractFontFaces } from './styles';

type StyleSource = string | CSSStyleSheet;

// Page-wide state, shared by every instance: the stylesheet source, its
// adopted sheets, and the document-level font sheet.
let bundledCss: string | null = null;
let override: StyleSource | null = null;
let shadowSheet: CSSStyleSheet | null = null;
let fontSheet: CSSStyleSheet | null = null;
const liveElements = new Set<FlowBuilderElement>();

function cssText(): string | null {
  return typeof override === 'string' ? override : override ? null : bundledCss;
}

function resolveSheet(): CSSStyleSheet | null {
  if (override && typeof override !== 'string') return override;
  const css = cssText();
  if (css == null) return null;
  if (!shadowSheet) {
    shadowSheet = new CSSStyleSheet();
    shadowSheet.replaceSync(buildShadowCss(css));
  }
  return shadowSheet;
}

// `@font-face` only works at document level, so the (prefixed) font rules go
// in a sheet appended to `document.adoptedStyleSheets`, once, next to
// whatever the host already adopted. A CSSStyleSheet override carries no
// text to take the rules from, so only text sources feed the fonts.
function ensureDocumentFonts(): void {
  const css = cssText();
  if (fontSheet || css == null) return;
  const faces = extractFontFaces(css);
  if (!faces) return;
  fontSheet = new CSSStyleSheet();
  fontSheet.replaceSync(faces);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, fontSheet];
}

export class FlowBuilderElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return [...OBSERVED_ATTRIBUTES];
  }

  /**
   * Replace the bundled stylesheet with CSS text (the compiled `app.css`) or a
   * ready CSSStyleSheet. Elements already connected re-adopt it. A sheet
   * object is adopted as is, so it should already include the builder's
   * `@property` fallbacks (text goes through `buildShadowCss` for them).
   */
  static setStyles(styles: StyleSource): void {
    override = styles;
    shadowSheet = null;
    for (const el of liveElements) el.adoptStyles();
  }

  /** @internal Set by index.ts to the CSS compiled into the build. */
  static setBundledStyles(css: string): void {
    bundledCss = css;
    shadowSheet = null;
  }

  #props: ElementProperties = {};
  #root: Root | null = null;
  readonly #shadow: ShadowRoot;
  readonly #mount: HTMLElement;
  readonly #callbacks = createEventCallbacks((name, detail) => {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  });

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#mount = document.createElement('div');
    // `all: initial` stops the host page's inherited text properties
    // (letter-spacing, text-transform, ...) flowing through the shadow
    // boundary; the builder's root sets the ones it needs itself. Set through
    // CSSOM, which a strict style-src CSP allows.
    this.#mount.style.cssText = 'all:initial;display:block;height:100%';
    this.#shadow.appendChild(this.#mount);
  }

  get theme() { return this.#props.theme; }
  set theme(value) { this.#set('theme', value); }
  get brand(): ElementBrand | undefined { return this.#props.brand; }
  set brand(value) { this.#set('brand', value); }
  get features() { return this.#props.features; }
  set features(value) { this.#set('features', value); }
  /** Overrides for any messages; anything missing falls back to English. */
  get messages() { return this.#props.messages; }
  set messages(value) { this.#set('messages', value); }
  get getHeaders() { return this.#props.getHeaders; }
  set getHeaders(value) { this.#set('getHeaders', value); }
  get fetch() { return this.#props.fetch; }
  set fetch(value) { this.#set('fetch', value); }
  /** The `locale` attribute (BCP 47, e.g. `de`). */
  get locale(): string | null { return this.getAttribute('locale'); }
  set locale(value: string | null) {
    if (value == null) this.removeAttribute('locale');
    else this.setAttribute('locale', value);
  }

  connectedCallback(): void {
    liveElements.add(this);
    this.adoptStyles();
    if (wantsFonts(this.getAttribute('fonts'))) ensureDocumentFonts();
    this.#root ??= createRoot(this.#mount);
    this.#render();
  }

  disconnectedCallback(): void {
    liveElements.delete(this);
    this.#root?.unmount();
    this.#root = null;
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  /** @internal */
  adoptStyles(): void {
    const sheet = resolveSheet();
    if (sheet) this.#shadow.adoptedStyleSheets = [sheet];
  }

  #set<K extends keyof ElementProperties>(key: K, value: ElementProperties[K]): void {
    this.#props = { ...this.#props, [key]: value };
    this.#render();
  }

  #render(): void {
    if (!this.#root) return;
    const attrs: ElementAttributes = {};
    for (const name of OBSERVED_ATTRIBUTES) attrs[name] = this.getAttribute(name);
    this.#root.render(React.createElement(FlowBuilder, buildElementProps(attrs, this.#props, this.#callbacks)));
  }
}
