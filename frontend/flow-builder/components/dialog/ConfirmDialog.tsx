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
import { Modal } from './Modal';
import { useT } from '../../i18n/I18nProvider';
import { Button, type ButtonVariant } from '../button/Button';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual weight of the confirm button (e.g. 'danger' for destructive ops). */
  tone?: Extract<ButtonVariant, 'primary' | 'danger' | 'accent'>;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Confirmation dialog built on top of Modal. Used for delete / publish.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? () => {} : onCancel}
      dismissable={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel ?? t('common.actions.cancel')}</Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? t('common.actions.working') : (confirmLabel ?? t('common.actions.confirm'))}
          </Button>
        </>
      }
    >
      {typeof message === 'string' ? <p>{message}</p> : message}
    </Modal>
  );
}
