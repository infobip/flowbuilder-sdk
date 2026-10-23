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

// ── WhatsApp Flow Preview · screen selection + child collection ─────────────
//
// Pure, dependency-free helpers that turn a (possibly hand-written / partial)
// Flow document into the concrete list of nodes a screen should render. Kept
// separate from the React layer so the selection rules can be unit-tested in
// isolation and the renderer stays a thin presentational shell.
//
// The three jobs here:
//   1. normalizeFlowDocument — accept an object OR a raw JSON string, tolerate
//      junk, and return a `FlowDocument | null`.
//   2. pickScreen — resolve the screen to render (by id, else the first).
//   3. collectRenderableChildren — flatten a screen's layout into a body list +
//      a single pinned Footer, expanding `If`/`Switch` and honoring `visible`.

import type {
  FlowComponentNode,
  FlowDocument,
  FlowScreen,
  PreviewRenderContext,
} from '../types';
import { evaluateCondition, resolveFlag } from '../runtime/condition';

/** Parse/validate arbitrary input into a FlowDocument. Never throws. */
export function normalizeFlowDocument(input: unknown): FlowDocument | null {
  if (input == null) return null;

  let value: unknown = input;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    try {
      value = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;

  // Some payloads wrap the document as `{ flow: {...} }`.
  const maybeWrapped = value as { flow?: unknown; screens?: unknown };
  if (!Array.isArray(maybeWrapped.screens) && maybeWrapped.flow && typeof maybeWrapped.flow === 'object') {
    value = maybeWrapped.flow;
  }

  const doc = value as FlowDocument;
  if (!Array.isArray(doc.screens)) return null;
  return doc;
}

/** Resolve the screen to render: the id match, else the first screen. */
export function pickScreen(doc: FlowDocument | null, screenId?: string): FlowScreen | null {
  const screens = doc?.screens;
  if (!Array.isArray(screens) || screens.length === 0) return null;
  if (screenId) {
    const match = screens.find((screen) => screen && screen.id === screenId);
    if (match) return match;
  }
  return screens[0] ?? null;
}

const FOOTER_TYPE = 'Footer';

// Transparent layout containers: they own no visual chrome of their own, they
// just group their `children`. We flatten straight through them so the inner
// components render inline (and any trailing Footer bubbles up to be pinned).
// `Form` is the common one — it wraps a screen's inputs and holds the Footer.
const TRANSPARENT_CONTAINER_TYPES = new Set(['Form', 'Layout', 'SingleColumnLayout']);

function isNode(value: unknown): value is FlowComponentNode {
  return value != null && typeof value === 'object' && typeof (value as FlowComponentNode).type === 'string';
}

/**
 * Recursively flatten a node list, expanding conditional + layout containers:
 *   - `If`  → its `then`/`children` when the condition holds, else `else`.
 *   - `Switch` → the matching `cases[value]` branch (or `default`).
 *   - `Form` / layout wrappers → their `children`, rendered transparently.
 * Nodes whose `visible` flag resolves false are dropped. Footer nodes are kept
 * in-stream here; the caller peels the trailing Footer off afterwards.
 */
function flattenNodes(nodes: unknown, ctx: PreviewRenderContext): FlowComponentNode[] {
  if (!Array.isArray(nodes)) return [];
  const out: FlowComponentNode[] = [];

  for (const raw of nodes) {
    if (!isNode(raw)) continue;
    if (!resolveFlag(raw.visible, ctx)) continue;

    if (raw.type === 'If') {
      const branch = evaluateCondition(raw.condition, ctx)
        ? (raw.then ?? raw.children)
        : raw.else;
      out.push(...flattenNodes(branch, ctx));
      continue;
    }

    if (raw.type === 'Switch') {
      const value = raw.value == null ? '' : String(raw.value);
      const cases = (raw.cases && typeof raw.cases === 'object' ? raw.cases : {}) as Record<string, unknown>;
      const branch = value in cases ? cases[value] : (raw.default ?? cases.default);
      out.push(...flattenNodes(branch, ctx));
      continue;
    }

    if (TRANSPARENT_CONTAINER_TYPES.has(raw.type)) {
      out.push(...flattenNodes(raw.children, ctx));
      continue;
    }

    out.push(raw);
  }

  return out;
}

export interface ScreenContent {
  /** Body nodes to render in the scrolling region, in order. */
  body: FlowComponentNode[];
  /** The single pinned Footer node, if the screen has one. */
  footer: FlowComponentNode | null;
}

/**
 * Flatten a screen's layout into `{ body, footer }`. The last Footer in the
 * flattened stream is pinned; any earlier ones stay inline (rare, defensive).
 */
export function collectRenderableChildren(screen: FlowScreen | null, ctx: PreviewRenderContext): ScreenContent {
  if (!screen) return { body: [], footer: null };
  const flattened = flattenNodes(screen.layout?.children, ctx);

  let footer: FlowComponentNode | null = null;
  for (let i = flattened.length - 1; i >= 0; i -= 1) {
    if (flattened[i].type === FOOTER_TYPE) {
      footer = flattened[i];
      flattened.splice(i, 1);
      break;
    }
  }

  const body = flattened.filter((node) => node.type !== FOOTER_TYPE);
  return { body, footer };
}
