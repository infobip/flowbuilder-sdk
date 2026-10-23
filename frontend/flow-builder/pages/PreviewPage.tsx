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

// Read-only preview page for published flows. Shows only the live preview
// iframe (or image fallback) with a minimal header to return to the library.

import React, { useEffect, useState } from 'react';
import { Badge } from '../components/badge/Badge';
import { ErrorState } from '../components/empty-state/ErrorState';
import { Skeleton } from '../components/loading/Skeleton';
import { PreviewPanel } from '../features/editor/PreviewPanel';
import { BACK_BUTTON_CLASS } from '../features/editor/EditorTopBar';
import { useApiConfig } from '../app/apiConfig';
import { useI18n } from '../i18n/I18nProvider';
import { describeError } from '../i18n/errors';
import { PREVIEW_EXPIRY_FORMAT } from '../utils/editor';
import { useDocumentTitle, useNavigate } from '../app/instanceContext';
import type { FlowStatus } from '../../shared';
import { getFlow } from '../../services/whatsappFlows';
import { presentStatus } from '../utils/flowStatus';
import { useFlowPreview } from '../state/useFlowPreview';

export type PreviewPageProps = {
  flowId: string;
};

export function PreviewPage({ flowId }: PreviewPageProps) {
  const { t, formatDate } = useI18n();
  const api = useApiConfig();
  const navigate = useNavigate();
  const { preview, loading: previewLoading, error: previewError, reload: reloadPreview } = useFlowPreview(flowId);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<FlowStatus>('PUBLISHED');
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  // Bumped by Retry to refetch the flow's metadata in place.
  const [metaAttempt, setMetaAttempt] = useState(0);

  // Reported to the host (the standalone app writes document.title); null
  // until the flow loads, and again on leaving, so the host shows its default.
  useDocumentTitle(title ? t('preview.documentTitle', { title }) : null);

  useEffect(() => {
    const controller = new AbortController();
    setMetaLoading(true);
    setMetaError(null);

    void getFlow(flowId, { ...api, signal: controller.signal })
      .then((flow) => {
        if (controller.signal.aborted) return;
        setTitle(flow.displayName);
        setStatus(flow.status);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setMetaError(describeError(t, err, 'preview.errors.flowLoadFailed'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMetaLoading(false);
      });

    return () => controller.abort();
  }, [api, flowId, metaAttempt, t]);

  const loading = metaLoading || previewLoading;
  const error = metaError ?? previewError;
  const statusBadge = presentStatus(status, t);

  return (
    <div className="flex min-h-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4 pt-1 pb-2">
        <button type="button" className={BACK_BUTTON_CLASS} onClick={() => navigate({ name: 'library' })}>
          <span aria-hidden="true">←</span> {t('preview.backToLibrary')}
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          {metaLoading ? (
            <Skeleton width={180} height={20} rounded="md" />
          ) : (
            <h1 className="truncate text-18 font-semibold text-default">{title || t('preview.fallbackTitle')}</h1>
          )}
          <Badge tone={statusBadge.tone} dot>{statusBadge.label}</Badge>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2.5" aria-label={t('preview.mainLabel')}>
        {loading ? (
          <Skeleton width="100%" height="100%" rounded="xl" />
        ) : error ? (
          <ErrorState
            title={t('preview.unavailableTitle')}
            message={error}
            onRetry={() => {
              if (metaError) setMetaAttempt((attempt) => attempt + 1);
              reloadPreview();
            }}
          />
        ) : (
          <PreviewPanel hasFlow loading={false} generating={false} preview={preview} fill />
        )}
        {preview.expiresAt ? (
          <div className="text-center text-12 text-subtle">
            {t('preview.expires', { time: formatDate(preview.expiresAt, PREVIEW_EXPIRY_FORMAT) })}
          </div>
        ) : null}
      </main>
    </div>
  );
}
