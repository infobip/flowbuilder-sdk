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

// ── WhatsApp Flows service layer ──────────────────────────────────────────
//
// The single HTTP boundary for the Flow Manager. Components and hooks call
// these functions — they must NEVER call `fetch` (or the Infobip API) directly.
//
// Every request goes through the local Express proxy (`/*`) via `apiCall`,
// which keeps the Infobip API key server-side. The proxy in `server.js` is the
// source of truth for the exact Infobip endpoints and payloads.

import { apiCall, type ApiOptions } from '../api';
import {
  splitFlowName,
  type FlowCategory,
  type FlowStatus,
  type WhatsAppFlow,
} from '../shared';

// ── Domain models ─────────────────────────────────────────────────────────

// A flow as consumed by the manager UI. `displayName`/`responseId` are derived
// from the raw Infobip name via the repo's `##`-suffix convention (splitFlowName).
export type ManagedFlow = {
  id: string;
  name: string;
  displayName: string;
  responseId: string | null;
  status: FlowStatus;
  categories: FlowCategory[];
  updatedAt?: string | null;
};

function pickFlowTimestamp(raw: RawFlow): string | null {
  const candidate =
    raw.updatedAt ??
    raw.updated_at ??
    raw.modifiedAt ??
    raw.modified_at ??
    raw.lastUpdated ??
    raw.last_updated ??
    raw.createdAt ??
    raw.created_at ??
    null;
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
}

export type UpdateFlowInput = {
  name?: string;
  categories?: FlowCategory[];
};

export type DeleteFlowResult = {
  id: string;
  status: 'DELETED';
};

export type PublishFlowResult = {
  id?: string;
  status?: FlowStatus;
  [key: string]: unknown;
};

export type GenerateFlowResult = { flow: WhatsAppFlow; responseId?: string };

export type CreateFlowInput = {
  name: string;
  responseId?: string;
  category: FlowCategory;
  flow: WhatsAppFlow;
};

export type CreateFlowResult = { id: string; name: string; responseId?: string; validationErrors?: unknown };

export type ReplaceFlowResult = { id: string; validationErrors?: unknown; infobip?: unknown };

// ── Raw proxy response shapes (permissive — Infobip's payload is not typed) ──

type RawFlow = {
  id: string;
  name?: string;
  status?: FlowStatus;
  categories?: FlowCategory[];
  [key: string]: unknown;
};

type ListFlowsResponse = {
  flows?: RawFlow[];
};

// Normalize a raw Infobip flow object into the UI-facing ManagedFlow shape.
export function toManagedFlow(raw: RawFlow): ManagedFlow {
  const rawName = raw.name ?? '';
  const parsed = splitFlowName(rawName);
  return {
    id: raw.id,
    name: rawName,
    displayName: parsed.displayName,
    responseId: parsed.responseId,
    status: (raw.status as FlowStatus) ?? 'DRAFT',
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    updatedAt: pickFlowTimestamp(raw),
  };
}

// ── Service functions ───────────────────────────────────────────────────────

// GET /flows — list every flow for the configured sender.
export async function getFlows(options?: ApiOptions): Promise<ManagedFlow[]> {
  const result = await apiCall<ListFlowsResponse>(options, 'Flows', '/flows', 'GET');
  return (result.flows ?? []).map(toManagedFlow);
}

// GET /flow/:id — fetch a single flow's metadata.
//
// Infobip does not reliably expose a standalone metadata GET for a flow, so we
// fall back to the flows list and hydrate the matching item when the direct call
// returns a not-found error.
export async function getFlow(id: string, options?: ApiOptions): Promise<ManagedFlow> {
  try {
    // The 404 is handled below, so it must not reach the host's error callback.
    const result = await apiCall<RawFlow>({ ...options, onError: undefined }, 'Flow', `/flow/${id}`, 'GET');
    return toManagedFlow(result);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const notFound = message.includes('404') || message.includes('not found') || message.includes('requested url not found');
    if (!notFound) throw error;

    const flows = await getFlows(options);
    const match = flows.find((flow) => flow.id === id);
    if (match) return match;

    throw error;
  }
}

// PATCH /update-flow/:id — update flow metadata (name and/or categories).
export async function updateFlow(id: string, data: UpdateFlowInput, options?: ApiOptions): Promise<ManagedFlow> {
  const body: UpdateFlowInput = {};
  if (typeof data.name === 'string' && data.name.trim()) body.name = data.name.trim();
  if (Array.isArray(data.categories) && data.categories.length > 0) body.categories = data.categories;

  const result = await apiCall<RawFlow>(options, 'Update flow', `/update-flow/${id}`, 'PATCH', body);
  return toManagedFlow(result);
}

// DELETE /flow/:id — permanently delete a flow.
export async function deleteFlow(id: string, options?: ApiOptions): Promise<DeleteFlowResult> {
  return apiCall<DeleteFlowResult>(options, 'Delete flow', `/flow/${id}`, 'DELETE');
}

// POST /publish-flow — publish a draft flow.
export async function publishFlow(id: string, options?: ApiOptions): Promise<PublishFlowResult> {
  return apiCall<PublishFlowResult>(options, 'Publish flow', '/publish-flow', 'POST', { flowId: id });
}

// PUT /flow/:id/json — upload / replace the flow JSON definition.
export async function uploadFlowJson(id: string, json: WhatsAppFlow, options?: ApiOptions): Promise<unknown> {
  return apiCall(options, 'Upload flow JSON', `/flow/${id}/json`, 'PUT', json);
}

// GET /flow/:id/json — download the flow JSON definition.
export async function downloadFlowJson(id: string, options?: ApiOptions): Promise<unknown> {
  return apiCall(options, 'Download flow JSON', `/flow/${id}/json`, 'GET');
}

// POST /generate-flow — generate a flow from a prompt. Pass the previous
// `responseId` to refine an existing flow instead of starting over.
export async function generateFlow(
  prompt: string,
  responseId: string | undefined,
  options?: ApiOptions,
): Promise<GenerateFlowResult> {
  return apiCall<GenerateFlowResult>(options, 'Generate flow', '/generate-flow', 'POST', { prompt, responseId });
}

// POST /save-flow — create a new flow from a generated definition.
export async function createFlow(input: CreateFlowInput, options?: ApiOptions): Promise<CreateFlowResult> {
  return apiCall<CreateFlowResult>(options, 'Save flow', '/save-flow', 'POST', input);
}

// PUT /update-flow/:id — replace an existing flow's definition with a
// generated one (the PATCH variant above only edits name/categories).
export async function replaceFlowDefinition(
  id: string,
  flow: WhatsAppFlow,
  options?: ApiOptions,
): Promise<ReplaceFlowResult> {
  return apiCall<ReplaceFlowResult>(options, 'Update flow', `/update-flow/${id}`, 'PUT', flow);
}
