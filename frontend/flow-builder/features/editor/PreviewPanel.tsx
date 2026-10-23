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

// ── Flow Builder editor live preview ───────────────────────────────────────
//
// Renders the editor's preview. The source is always the confirmed preview API
// (`services/flowPreview.fetchFlowPreview` via the editor hook) — never the
// scripted library renderer. Every state renders inside one plain rounded panel
// (no phone chrome):
//   - empty     → placeholder message
//   - loading   → spinner (covers first-prompt generation)
//   - ready     → the API iframe/image
//   - error     → the shared ErrorState

import React from 'react';
import { ErrorState } from '../../components/empty-state/ErrorState';
import type { FlowPreviewState } from '../../services/flowPreview';
import { useT } from '../../i18n/I18nProvider';
import { cx } from '../../utils/cx';

export type PreviewPanelProps = {
  hasFlow: boolean;
  /** True while the flow itself is loading (initial open). */
  loading: boolean;
  /** True while a generate turn is in flight. */
  generating: boolean;
  preview: FlowPreviewState;
  /** Grow to fill a flex column, with a taller floor (the published-flow preview page). */
  fill?: boolean;
};

const PANEL_CLASS = 'overflow-hidden rounded border border-default';
// The live frame fills the builder's height (minus the sticky top bar, action
// bar and padding) with a floor so it stays usable on short screens; the
// placeholders match it so the layout doesn't jump when the frame loads.
// `--fb-vh` is the builder root's height in layout "fill"; in "page" it is
// unset and the viewport height applies, as before.
const INLINE_HEIGHT = 'min-h-[max(440px,calc(var(--fb-vh,100vh)-230px))]';
const FILL_HEIGHT = 'min-h-[max(520px,calc(var(--fb-vh,100vh)-140px))]';
const INLINE_FRAME_HEIGHT = 'h-[max(440px,calc(var(--fb-vh,100vh)-230px))]';

function PlaceholderPanel({ fill, children }: { fill: boolean; children: React.ReactNode }) {
  const t = useT();
  return (
    <div
      className={cx(
        PANEL_CLASS,
        'flex items-center justify-center bg-surface px-6 py-8',
        fill ? cx('flex-1 flex-col', FILL_HEIGHT) : INLINE_HEIGHT,
      )}
      role="img"
      aria-label={t('codeEditor.preview.label')}
    >
      {children}
    </div>
  );
}

function PreviewEmpty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-30 text-subtle" aria-hidden="true">▤</span>
      <div className="text-15 font-semibold text-default">{title}</div>
      {text ? <p className="max-w-[200px] text-13 text-muted">{text}</p> : null}
    </div>
  );
}

export function PreviewPanel({ hasFlow, loading, generating, preview, fill = false }: PreviewPanelProps) {
  const t = useT();
  const isLoading = generating || loading || preview.status === 'loading';
  const livePanelClass = cx(PANEL_CLASS, 'bg-preview-backdrop', fill && cx('flex flex-1 flex-col', FILL_HEIGHT));

  if (isLoading) {
    return (
      <PlaceholderPanel fill={fill}>
        <div className="flex flex-col items-center gap-3.5">
          <span
            className="size-8.5 animate-spin rounded-full border-3 border-default border-t-primary motion-reduce:animate-spin-slow"
            aria-hidden="true"
          />
          <div className="text-13 text-muted">{t('codeEditor.preview.building')}</div>
        </div>
      </PlaceholderPanel>
    );
  }

  if (!hasFlow) {
    return (
      <PlaceholderPanel fill={fill}>
        <PreviewEmpty title={t('codeEditor.preview.emptyTitle')} text={t('codeEditor.preview.emptyText')} />
      </PlaceholderPanel>
    );
  }

  if (preview.status === 'error' || preview.status === 'unavailable') {
    return <ErrorState title={t('codeEditor.preview.unavailableTitle')} message={preview.error ?? t('codeEditor.preview.couldNotLoad')} />;
  }

  if (preview.kind === 'image' && preview.url) {
    return (
      <div className={livePanelClass}>
        <img alt={t('codeEditor.preview.label')} src={preview.url} className="block w-full" />
      </div>
    );
  }

  if (preview.url) {
    return (
      <div className={livePanelClass}>
        <iframe
          title={t('codeEditor.preview.label')}
          src={preview.url}
          className={cx(
            'block w-full border-0 bg-preview-backdrop',
            fill ? cx('h-full flex-1', FILL_HEIGHT) : INLINE_FRAME_HEIGHT,
          )}
        />
      </div>
    );
  }

  return (
    <PlaceholderPanel fill={fill}>
      <PreviewEmpty title={t('codeEditor.preview.nothingYet')} />
    </PlaceholderPanel>
  );
}
