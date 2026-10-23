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

// ── WhatsApp Flow Preview · template resolution ─────────────────────────────
//
// Pure, dependency-free resolution of Flow's `${…}` template strings and
// dynamic `data-source` values. Kept entirely separate from the visual
// components so the substitution rules can be unit-tested in isolation and the
// renderer stays a thin presentational layer.
//
// Supported references (dot paths, defensive against missing keys):
//   ${data.field}      → runtime data (overlaid on screen __example__ values)
//   ${form.field}      → current form values
//   ${screen.field}    → the raw screen object
//
// There is NO eval / Function here — resolution is a plain object walk.

import type {
  FlowDataSourceItem,
  FlowFormValues,
  FlowRuntimeData,
  FlowScreen,
  PreviewRenderContext,
  ScreenDataField,
} from '../types';

const FULL_EXPR = /^\s*\$\{([^}]+)\}\s*$/;
const PART_EXPR = /\$\{([^}]+)\}/g;

/** Walk a dotted path (`a.b.c` and `a.items[0]`) against a root object. */
function getPath(root: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1') // items[0] → items.0
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Resolve a single reference expression (the text inside `${…}`). */
export function lookupReference(expr: string, ctx: PreviewRenderContext): unknown {
  const scope: Record<string, unknown> = {
    data: ctx.data,
    form: ctx.form,
    screen: ctx.screen,
  };
  return getPath(scope, expr.trim());
}

/**
 * Resolve a value that MAY be a template string.
 *  - A string that is exactly one `${…}` returns the *raw* resolved value
 *    (so `"${data.options}"` yields the underlying array, not "[object …]").
 *  - A string with embedded `${…}` returns an interpolated string.
 *  - Anything else is returned unchanged.
 */
export function resolveTemplateValue(input: unknown, ctx: PreviewRenderContext): unknown {
  if (typeof input !== 'string') return input;

  const whole = input.match(FULL_EXPR);
  if (whole) return lookupReference(whole[1], ctx);

  if (!input.includes('${')) return input;

  return input.replace(PART_EXPR, (_match, expr: string) => {
    const value = lookupReference(expr, ctx);
    return value == null ? '' : String(value);
  });
}

/** Resolve a value to a display string (empty string for null/undefined). */
export function resolveText(input: unknown, ctx: PreviewRenderContext): string {
  const value = resolveTemplateValue(input, ctx);
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function normalizeDataSourceItem(raw: unknown, index: number, ctx: PreviewRenderContext): FlowDataSourceItem {
  if (raw == null || typeof raw !== 'object') {
    return { id: String(index), title: resolveText(raw, ctx) };
  }
  const item = raw as Record<string, unknown>;
  const idSource = item.id ?? item.value ?? item.title ?? index;
  return {
    id: String(idSource),
    title: resolveText(item.title ?? item.label ?? item.id, ctx),
    description: item.description != null ? resolveText(item.description, ctx) : undefined,
    metadata: item.metadata != null ? resolveText(item.metadata, ctx) : undefined,
    image: typeof item.image === 'string' ? item.image : undefined,
    enabled: item.enabled === false ? false : true,
    'alt-text': typeof item['alt-text'] === 'string' ? (item['alt-text'] as string) : undefined,
  };
}

/**
 * Resolve a `data-source` (inline array OR a `${data.field}` template) to a
 * normalized option list. Always returns an array — never throws.
 */
export function resolveDataSource(input: unknown, ctx: PreviewRenderContext): FlowDataSourceItem[] {
  const resolved = resolveTemplateValue(input, ctx);
  if (!Array.isArray(resolved)) return [];
  return resolved.map((item, index) => normalizeDataSourceItem(item, index, ctx));
}

function isScreenDataField(value: unknown): value is ScreenDataField {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('__example__' in (value as Record<string, unknown>) || 'type' in (value as Record<string, unknown>))
  );
}

/**
 * Build the effective data bag for a screen: each declared `data` key resolves
 * to its `__example__` value, then any runtime `data` overrides those examples.
 * This is what makes example data visible in a static thumbnail.
 */
export function buildEffectiveData(
  screen: FlowScreen | undefined,
  runtimeData: FlowRuntimeData | undefined,
): FlowRuntimeData {
  const out: FlowRuntimeData = {};
  const declared = screen?.data;
  if (declared && typeof declared === 'object') {
    for (const [key, field] of Object.entries(declared)) {
      if (isScreenDataField(field)) {
        if ('__example__' in field) out[key] = field.__example__;
      } else {
        out[key] = field;
      }
    }
  }
  if (runtimeData && typeof runtimeData === 'object') {
    for (const [key, value] of Object.entries(runtimeData)) {
      out[key] = value;
    }
  }
  return out;
}

/** Shallow, defensive clone of form values (never mutate caller input). */
export function buildFormValues(initial: FlowFormValues | undefined): FlowFormValues {
  return initial && typeof initial === 'object' ? { ...initial } : {};
}
