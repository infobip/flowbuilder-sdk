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

// ── WhatsApp Flow Preview · surface component ───────────────────────────────
//
// The public renderer. Turns Flow JSON into the white WhatsApp Flow "surface":
// a top bar (screen title), a scrolling content region (body components), and a
// pinned Footer button. It is a thin shell over the pure runtime + selection
// helpers and the `wafp-*` stylesheet — all the real logic lives in those.
//
// The surface renders at a fixed unscaled `width × height` and is CSS-scaled by
// `scale`; the outer box reserves the *scaled* dimensions so no empty layout
// space leaks around a thumbnail.

import React, { useMemo } from 'react';
import type { FlowComponentNode, PreviewRenderContext, WhatsAppFlowPreviewProps } from '../types';
import { buildEffectiveData, buildFormValues, resolveText } from '../runtime/template';
import { resolveFlag } from '../runtime/condition';
import { collectRenderableChildren, normalizeFlowDocument, pickScreen } from './selectScreen';
import { renderNode } from './components';
import { ChevronLeftIcon, KebabIcon } from './icons';

/** True when an interactive Footer should be disabled (required field empty). */
function isFooterDisabled(body: FlowComponentNode[], ctx: PreviewRenderContext): boolean {
  if (!ctx.interactive) return false;
  return body.some((node) => {
    if (node.required == null || !resolveFlag(node.required, ctx)) return false;
    const name = typeof node.name === 'string' ? node.name : undefined;
    if (!name) return false;
    const value = ctx.form[name];
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
  });
}

export function WhatsAppFlowPreview({
  flowJson,
  screenId,
  width = 360,
  height = 640,
  scale = 1,
  interactive = false,
  data,
  initialValues,
  className,
  ariaLabel,
}: WhatsAppFlowPreviewProps) {
  const doc = useMemo(() => normalizeFlowDocument(flowJson), [flowJson]);
  const screen = useMemo(() => pickScreen(doc, screenId), [doc, screenId]);

  const ctx = useMemo<PreviewRenderContext>(() => ({
    data: buildEffectiveData(screen ?? undefined, data),
    form: buildFormValues(initialValues),
    interactive,
    screen: screen ?? { id: '' },
  }), [screen, data, initialValues, interactive]);

  const content = useMemo(() => collectRenderableChildren(screen, ctx), [screen, ctx]);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  const footerNode = content.footer;
  const footerLabel = footerNode ? resolveText(footerNode.label, ctx) || 'Continue' : null;
  const footerDisabled = footerNode ? isFooterDisabled(content.body, ctx) : false;
  const leftCaption = footerNode ? resolveText(footerNode['left-caption'], ctx) : '';
  const centerCaption = footerNode ? resolveText(footerNode['center-caption'], ctx) : '';
  const rightCaption = footerNode ? resolveText(footerNode['right-caption'], ctx) : '';
  const hasCaptions = Boolean(leftCaption || centerCaption || rightCaption);

  const title = screen ? resolveText(screen.title, ctx) : '';

  // A non-interactive surface is a picture of a flow, so it is exposed as a
  // single labelled image and its innards are hidden. Without that the rendered
  // flow content — including its headings — leaks into the host page's
  // accessibility tree and corrupts the document outline. An interactive surface
  // is a real widget, so it keeps its semantics.
  const asImage = !interactive;

  return (
    <div
      className={['wafp-root', 'wafp-scale', className].filter(Boolean).join(' ')}
      style={{ width: scaledWidth, height: scaledHeight }}
      role={asImage ? 'img' : undefined}
      aria-label={asImage ? ariaLabel ?? (title ? `${title} flow preview` : 'Flow preview') : undefined}
    >
      <div
        className="wafp-scale-inner"
        style={{ width, height, transform: scale === 1 ? undefined : `scale(${scale})` }}
        aria-hidden={asImage || undefined}
      >
        <div className={`wafp-surface${interactive ? '' : ' wafp-surface--inert'}`} style={{ width, height }}>
          <div className="wafp-topbar">
            <span className="wafp-topbar-back" aria-hidden="true"><ChevronLeftIcon size={20} /></span>
            <span className="wafp-topbar-title">{title}</span>
            <span className="wafp-topbar-menu" aria-hidden="true"><KebabIcon size={20} /></span>
          </div>

          {doc && screen ? (
            <div className="wafp-scroll">
              {content.body.map((node, index) => renderNode(node, ctx, `${node.type}-${index}`))}
            </div>
          ) : (
            <div className="wafp-empty">No screen to preview</div>
          )}

          {footerNode ? (
            <div className="wafp-footer">
              <div className={`wafp-footer-btn${footerDisabled ? ' wafp-footer-btn--disabled' : ''}`}>{footerLabel}</div>
              {hasCaptions ? (
                <div className="wafp-footer-captions">
                  <span className="wafp-footer-caption">{leftCaption}</span>
                  <span className="wafp-footer-caption wafp-footer-caption--center">{centerCaption}</span>
                  <span className="wafp-footer-caption">{rightCaption}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
