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

import React from 'react';
import { useT } from '../../i18n/I18nProvider';
import { useFeatures } from '../../app/hostConfig';
import { Button } from '../../components/button/Button';
import { Badge } from '../../components/badge/Badge';
import type { ManagedFlow } from '../../types/flowBuilder';
import { categoryLabel } from '../../utils/library';
import { presentStatus } from '../../utils/flowStatus';
import { canDeleteFlow, canEditFlow, canPublishFlow, canViewFlow } from './libraryView';
import { PhoneFrame, WhatsAppFlowPreview } from '../../whatsapp-flow-preview';
import { useFlowJson } from '../../state/useFlowJson';
import { SKELETON_CLASS } from '../../components/loading/Skeleton';
import { cx } from '../../utils/cx';

export type LibraryCardProps = {
  flow: ManagedFlow;
  onEdit: (flow: ManagedFlow) => void;
  onView: (flow: ManagedFlow) => void;
  onPublish: (flow: ManagedFlow) => void;
  onDelete: (flow: ManagedFlow) => void;
  actionsDisabled?: boolean;
};

// Unscaled surface size + the thumbnail scale used inside the card. The phone
// frame reserves the *scaled* footprint so the card column stays a fixed width.
const SURFACE_W = 360;
const SURFACE_H = 640;
const PREVIEW_SCALE = 0.42;

// Phone chrome around the scaled surface (must track PhoneFrame + styles.ts):
// the status bar height plus the frame's top/bottom border.
const PHONE_STATUSBAR_H = 20;
const PHONE_BORDER = 1;
const PHONE_H = PHONE_STATUSBAR_H + Math.round(SURFACE_H * PREVIEW_SCALE) + PHONE_BORDER * 2;

// The card is a touch shorter than the full phone, so its bottom edge slices the
// phone's rounded base off — leaving the pinned footer button right above the
// cut line (see the reference screenshot).
const PREVIEW_CLIP = 3;
const PREVIEW_VISIBLE_H = PHONE_H - PREVIEW_CLIP;

// The card's height is pinned to the preview footprint so every card is uniform
// and the phone always bleeds flush to the bottom border. Without this the card
// stretches to whichever column is taller — a wordy meta column (long title /
// many badges) would otherwise grow the card and strand the phone above the
// bottom edge. Must track the card's `pt-3.5` top padding + `border` width.
const CARD_PAD_TOP = 14;
const CARD_BORDER = 1;
/** Fixed height shared by every library grid tile (flow cards + the create tile). */
export const LIBRARY_CARD_HEIGHT = CARD_PAD_TOP + PREVIEW_VISIBLE_H + CARD_BORDER * 2;

// Scaled footprint the phone frame renders at.
const PREVIEW_W = Math.round(SURFACE_W * PREVIEW_SCALE);
const PREVIEW_BODY_H = Math.round(SURFACE_H * PREVIEW_SCALE);

const SKELETON_BAR_CLASS = 'h-[9px] w-full rounded';
const SKELETON_BAR_SHORT_CLASS = 'h-[9px] w-[52%] rounded';
const SKELETON_BAR_HEADING_CLASS = 'mb-1 h-[13px] w-[68%] rounded';

// Shimmering stand-in shown while the flow JSON loads. It reuses the phone frame
// and echoes the real preview's layout (top-bar title, a few content lines, a
// pinned footer button) so the card doesn't jump when the live preview swaps in.
function CardPreviewSkeleton() {
  return (
    <PhoneFrame width={PREVIEW_W}>
      <div className="flex flex-col bg-surface" style={{ height: PREVIEW_BODY_H }} aria-hidden="true">
        <div className="flex h-6.5 flex-none items-center justify-center border-b border-default">
          <span className={cx(SKELETON_CLASS, 'h-2 w-[46%] rounded')} />
        </div>
        <div className="flex flex-auto flex-col gap-2.5 px-3 py-3.5">
          <span className={cx(SKELETON_CLASS, SKELETON_BAR_HEADING_CLASS)} />
          <span className={cx(SKELETON_CLASS, SKELETON_BAR_CLASS)} />
          <span className={cx(SKELETON_CLASS, SKELETON_BAR_SHORT_CLASS)} />
          <span className={cx(SKELETON_CLASS, SKELETON_BAR_CLASS)} />
          <span className={cx(SKELETON_CLASS, SKELETON_BAR_SHORT_CLASS)} />
        </div>
        <div className="flex-none border-t border-default px-3 pt-2.5 pb-3">
          <span className={cx(SKELETON_CLASS, 'h-6.5 w-full rounded-md')} />
        </div>
      </div>
    </PhoneFrame>
  );
}

// The phone-frame thumbnail: skeleton while the JSON loads, a neutral
// placeholder if it can't be fetched, otherwise a live first-screen preview.
function CardPreview({ flow }: { flow: ManagedFlow }) {
  const t = useT();
  const { doc, loading } = useFlowJson(flow.id);

  if (loading) {
    return <CardPreviewSkeleton />;
  }

  if (!doc) {
    return (
      <PhoneFrame width={PREVIEW_W}>
        <div
          className="flex w-full flex-col items-center justify-center gap-1.5 bg-surface-sunken text-12 text-subtle"
          style={{ height: PREVIEW_BODY_H }}
        >
          <span className="text-26 leading-none" aria-hidden="true">◇</span>
          <span>{t('library.card.noPreview')}</span>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame width={PREVIEW_W}>
      <WhatsAppFlowPreview
        flowJson={doc}
        width={SURFACE_W}
        height={SURFACE_H}
        scale={PREVIEW_SCALE}
        interactive={false}
        ariaLabel={t('library.card.previewAria', { name: flow.displayName })}
      />
    </PhoneFrame>
  );
}

export function LibraryCard({ flow, onEdit, onView, onPublish, onDelete, actionsDisabled = false }: LibraryCardProps) {
  const t = useT();
  const status = presentStatus(flow.status, t);
  const categories = flow.categories.length === 0
    ? [t('library.category.uncategorized')]
    : flow.categories.map((category) => categoryLabel(category, t));
  const editable = canEditFlow(flow);
  const viewable = canViewFlow(flow);
  const features = useFeatures();
  const publishable = features.publish && canPublishFlow(flow);
  const deletable = features.delete && canDeleteFlow(flow);

  return (
    // No bottom padding: the phone preview bleeds to the card's bottom border so
    // its sliced base sits flush against the edge, and overflow-hidden clips it
    // to the card's corners. The meta column re-adds its own bottom padding.
    <div
      className="flex gap-4 overflow-hidden rounded border border-default bg-surface px-3.5 pt-3.5 text-left shadow-(--fb-shadow-card) transition-[border-color,box-shadow] hover:border-strong"
      style={{ height: LIBRARY_CARD_HEIGHT }}
      role="listitem"
    >
      <div className="flex flex-none items-start justify-center overflow-hidden" style={{ height: PREVIEW_VISIBLE_H }}>
        <CardPreview flow={flow} />
      </div>

      {/* min-h-0 + overflow-hidden let the meta column shrink to the card's fixed
          height instead of stretching it (which would strand the phone above the edge). */}
      <div className="flex min-h-0 min-w-0 flex-auto flex-col gap-2.5 overflow-hidden pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {/* A heading so the library has an outline to navigate by. Clamped to
                two lines so a long title can't grow the fixed-height card. */}
            <h2 className="line-clamp-2 text-16 leading-[1.35] font-semibold wrap-anywhere">{flow.displayName}</h2>
            {/* An identifier, not prose — it gets the mono face like the JSON does. */}
            <div className="font-mono text-11.5 text-subtle wrap-anywhere">{flow.id}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categories.map((label) => (
            <Badge key={label} tone="neutral">{label}</Badge>
          ))}
        </div>

        <div className="flex">
          <Badge tone={status.tone} dot>{status.label}</Badge>
        </div>

        {/* Every card repeats the same verbs, so each button spells out which
            flow it acts on. The visible label stays short. */}
        <div className="flex flex-col gap-1.5">
          {editable ? (
            <Button size="sm" variant="secondary" block aria-label={t('library.actions.editAria', { name: flow.displayName })} onClick={() => onEdit(flow)} disabled={actionsDisabled}>
              {t('library.actions.edit')}
            </Button>
          ) : null}
          {viewable ? (
            <Button size="sm" variant="secondary" block aria-label={t('library.actions.viewAria', { name: flow.displayName })} onClick={() => onView(flow)} disabled={actionsDisabled}>
              {t('library.actions.view')}
            </Button>
          ) : null}
          {publishable ? (
            <Button size="sm" variant="primary" block aria-label={t('library.actions.publishAria', { name: flow.displayName })} onClick={() => onPublish(flow)} disabled={actionsDisabled}>
              {t('library.actions.publish')}
            </Button>
          ) : null}
          {deletable ? (
            <Button size="sm" variant="danger" block aria-label={t('library.actions.deleteAria', { name: flow.displayName })} onClick={() => onDelete(flow)} disabled={actionsDisabled}>
              {t('library.actions.delete')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
