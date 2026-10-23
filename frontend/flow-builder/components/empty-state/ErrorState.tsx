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
import { Button } from '../button/Button';
import { cx } from '../../utils/cx';
import { useT } from '../../i18n/I18nProvider';
import { STATE_CLASSES } from './EmptyState';

export type ErrorStateProps = {
  title?: string;
  message?: React.ReactNode;
  /** When provided, renders a "Try again" button wired to this handler. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions rendered next to retry. */
  actions?: React.ReactNode;
};

// Error state for failed loads/actions. Uses the danger tone treatment.
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  actions,
}: ErrorStateProps) {
  const t = useT();
  return (
    <div className={cx(STATE_CLASSES.root, 'border-danger bg-danger-soft')} role="alert">
      <div className={cx(STATE_CLASSES.icon, 'bg-surface text-danger')} aria-hidden="true">
        <span className="text-22 font-extrabold">!</span>
      </div>
      <h3 className={STATE_CLASSES.title}>{title ?? t('common.actions.errorTitle')}</h3>
      {message && <p className={STATE_CLASSES.message}>{message}</p>}
      {(onRetry || actions) && (
        <div className={STATE_CLASSES.actions}>
          {onRetry && <Button variant="secondary" onClick={onRetry}>{retryLabel ?? t('common.actions.tryAgain')}</Button>}
          {actions}
        </div>
      )}
    </div>
  );
}
