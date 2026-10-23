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

// ── Flow Builder lifecycle helpers ────────────────────────────────────────
//
// Pure helpers for editor lifecycle state. Keeping these rules in a small
// utility makes the React hooks thinner and gives us focused unit tests for dirty
// state detection and action gating.

import type { FlowStatus } from '../../shared';
import { canDelete as canDeleteFlow, canPublish as canPublishFlow } from './flowStatus';

export function hasEditorUnsavedChanges(params: {
  hasFlow: boolean;
  title: string;
  baselineTitle: string;
  prompt: string;
  baselinePrompt: string;
  jsonDraft: string;
  baselineJson: string;
}): boolean {
  if (!params.hasFlow) return false;
  return (
    params.title !== params.baselineTitle
    || params.prompt !== params.baselinePrompt
    || params.jsonDraft !== params.baselineJson
  );
}

export function hasSaveableEditorChanges(params: {
  title: string;
  baselineTitle: string;
  jsonDraft: string;
  baselineJson: string;
}): boolean {
  return params.title !== params.baselineTitle || params.jsonDraft !== params.baselineJson;
}

export function canSaveEditorDraft(params: {
  hasFlow: boolean;
  hasJsonError: boolean;
  busy: boolean;
  hasPersistableChanges: boolean;
}): boolean {
  return params.hasFlow && params.hasPersistableChanges && !params.hasJsonError && !params.busy;
}

export function canDeleteEditorFlow(params: {
  hasFlow: boolean;
  flowStatus: FlowStatus;
  busy: boolean;
}): boolean {
  return params.hasFlow && canDeleteFlow(params.flowStatus) && !params.busy;
}

export function canPublishEditorFlow(params: {
  hasFlow: boolean;
  flowStatus: FlowStatus;
  hasValidationErrors: boolean;
  hasJsonError: boolean;
  hasPersistableChanges: boolean;
  busy: boolean;
}): boolean {
  return (
    params.hasFlow
    && canPublishFlow(params.flowStatus)
    && !params.hasValidationErrors
    && !params.hasJsonError
    && !params.hasPersistableChanges
    && !params.busy
  );
}

export function canFixEditorErrors(params: {
  hasFlow: boolean;
  validationErrorCount: number;
  hasJsonError: boolean;
  busy: boolean;
}): boolean {
  return params.hasFlow && params.validationErrorCount > 0 && !params.hasJsonError && !params.busy;
}
