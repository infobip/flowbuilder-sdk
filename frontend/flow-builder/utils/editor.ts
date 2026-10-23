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

// ── Flow Builder editor helpers ────────────────────────────────────────────
//
// Pure helpers for the create/edit screen: starter prompts, document titles,
// and a few tiny derivations that keep the React component itself thinner.

import { buildFlowName } from '../../shared';
import type { Translate } from '../i18n/I18nProvider';
import type { EditorMode } from './routing';

export type EditorGenerationStatus = 'idle' | 'submitting' | 'generating' | 'success' | 'failure';

export type EditorStarterChoice = {
  label: string;
  prompt: string;
};

// The prompt is sent to the AI as written, so it is translated with the label.
export function getEditorStarterChoices(t: Translate): readonly EditorStarterChoice[] {
  return [
    { label: t('editor.starters.appointment.label'), prompt: t('editor.starters.appointment.prompt') },
    { label: t('editor.starters.lead.label'), prompt: t('editor.starters.lead.prompt') },
    { label: t('editor.starters.survey.label'), prompt: t('editor.starters.survey.prompt') },
    { label: t('editor.starters.event.label'), prompt: t('editor.starters.event.prompt') },
  ];
}

// How the preview's expiry time is shown: what `toLocaleString()` has always
// printed (numeric date and time with seconds), now in the host's locale.
export const PREVIEW_EXPIRY_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
};

export function normalizeEditorTitle(title: string, t: Translate): string {
  const trimmed = title.trim();
  return trimmed || t('editor.untitledFlow');
}

// Turn a free-text prompt into a concise, human-readable flow title. Uses the
// first line, collapses whitespace, and clips to a word boundary so the auto
// name is readable and stays well under the API's 200-char name budget (the
// generation responseId also has to fit alongside it).
export function deriveEditorTitleFromPrompt(prompt: string, maxLength = 60): string {
  const firstLine = prompt.split(/\r?\n/)[0].replace(/\s+/g, ' ').trim();
  if (firstLine.length <= maxLength) return firstLine;

  const clipped = firstLine.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const trimmed = (lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped).trimEnd();
  return `${trimmed}…`;
}

export function buildEditorFlowName(title: string, t: Translate, responseId?: string | null): string {
  return buildFlowName(normalizeEditorTitle(title, t), responseId);
}

export function resolveEditorDocumentTitle(
  params: {
    flowId: string | null;
    flowTitle: string;
    mode: EditorMode;
    productName: string;
  },
  t: Translate,
): string {
  const title = params.flowTitle.trim();
  const { productName } = params;
  if (!params.flowId) return t('editor.documentTitle.create', { productName });

  return title ? t('editor.documentTitle.named', { title, productName }) : t('editor.documentTitle.edit', { productName });
}
