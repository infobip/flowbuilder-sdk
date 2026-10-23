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

// Display names come from the catalogue (`library.categories.*`).
export const FLOW_CATEGORIES = [
  { value: 'SIGN_UP' },
  { value: 'SIGN_IN' },
  { value: 'APPOINTMENT_BOOKING' },
  { value: 'LEAD_GENERATION' },
  { value: 'CONTACT_US' },
  { value: 'CUSTOMER_SUPPORT' },
  { value: 'SURVEY' },
  { value: 'OTHER' },
] as const;

export type FlowCategory = (typeof FLOW_CATEGORIES)[number]['value'];

export type FlowStatus = 'none' | 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' | 'THROTTLED';

// Kept permissive: Infobip's validationErrors payload shape is not guaranteed,
// and we only need to count entries (enable/disable) and stringify them (fix prompt).
export type FlowValidationError = {
  error?: string;
  message?: string;
  line?: number;
  column?: number;
  [key: string]: unknown;
};

export function normalizeValidationErrors(input: unknown): FlowValidationError[] {
  if (!Array.isArray(input)) return [];
  return input.filter((entry): entry is FlowValidationError => entry != null);
}

export type WhatsAppFlow = {
  version: string;
  screens: Array<{
    id: string;
    title: string;
    terminal?: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

/** The chat timestamp, in the host's locale (the runtime default when `undefined`). */
export function nowTime(locale?: string) {
  return new Date().toLocaleTimeString(locale ? [locale] : [], { hour: '2-digit', minute: '2-digit' });
}

export function createMessageId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatFlowJson(flow: WhatsAppFlow | null | undefined) {
  return flow ? JSON.stringify(flow, null, 2) : '';
}

export function isWhatsAppFlow(value: unknown): value is WhatsAppFlow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as WhatsAppFlow;
  return typeof candidate.version === 'string' && Array.isArray(candidate.screens);
}

export function splitFlowName(name: string) {
  const rawName = String(name ?? '');
  const markerIndex = rawName.indexOf('##');
  if (markerIndex < 0) {
    return {
      displayName: rawName.trim() || 'Untitled flow',
      responseId: null,
    };
  }

  return {
    displayName: rawName.slice(0, markerIndex).trim() || 'Untitled flow',
    responseId: rawName.slice(markerIndex + 2).trim() || null,
  };
}

// The Infobip Flow Management API caps the flow `name` at 200 characters. The
// name doubles as our carrier for the generation `responseId` (`name##responseId`),
// and that suffix must survive intact so `splitFlowName` can recover it — so we
// only ever truncate the human-readable base name, never the responseId.
export const MAX_FLOW_NAME_LENGTH = 200;

export function buildFlowName(displayName: string, responseId?: string | null) {
  const baseName = displayName.trim() || 'Untitled flow';
  const nextResponseId = responseId?.trim();
  if (!nextResponseId) return baseName.slice(0, MAX_FLOW_NAME_LENGTH);

  const suffix = `##${nextResponseId}`;
  const room = MAX_FLOW_NAME_LENGTH - suffix.length;
  if (room <= 0) return suffix; // pathological: responseId alone fills the budget
  const safeBase = baseName.slice(0, room).trimEnd() || baseName.slice(0, room);
  return `${safeBase}${suffix}`;
}

// ── Cross-controller flow sync ─────────────────────────────────────────────
//
// Whoever creates, updates, publishes or deletes a flow (the editor, the Flow
// Library) broadcasts it on a flow sync bus, so a mounted library reloads
// straight away instead of waiting for a manual refresh. Each builder instance
// owns its own bus (flow-builder/app/instanceContext.tsx), so two builders on
// one page never hear each other.

export type FlowSyncFlow = {
  id: string;
  name: string;
  status: FlowStatus;
  categories: FlowCategory[];
  updatedAt?: string | null;
};

export type FlowSyncEvent =
  | { type: 'created'; flow: FlowSyncFlow }
  | { type: 'updated'; flow: FlowSyncFlow }
  | { type: 'published'; flow: FlowSyncFlow }
  | { type: 'deleted'; id: string };

const FLOW_SYNC_EVENT = 'fb-flow-sync';

export type FlowSyncBus = {
  /** Broadcast a change so every controller on this bus updates immediately. */
  publish(event: FlowSyncEvent): void;
  /** Subscribe to broadcasts. Returns an unsubscribe function. */
  subscribe(handler: (event: FlowSyncEvent) => void): () => void;
};

export function createFlowSyncBus(): FlowSyncBus {
  const bus = new EventTarget();
  return {
    publish(event) {
      bus.dispatchEvent(new CustomEvent<FlowSyncEvent>(FLOW_SYNC_EVENT, { detail: event }));
    },
    subscribe(handler) {
      const listener = (e: Event) => handler((e as CustomEvent<FlowSyncEvent>).detail);
      bus.addEventListener(FLOW_SYNC_EVENT, listener);
      return () => bus.removeEventListener(FLOW_SYNC_EVENT, listener);
    },
  };
}
