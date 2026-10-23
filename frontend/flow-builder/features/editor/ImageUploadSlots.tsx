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

import React, { useRef } from 'react';
import { Button } from '../../components/button/Button';
import { useT } from '../../i18n/I18nProvider';
import type { ImageUploadSlot } from '../../utils/imageUploads';

export type ImageUploadSlotsProps = {
  slots: ImageUploadSlot[];
  busySlotKey: string | null;
  error: string | null;
  disabled: boolean;
  onUpload: (slot: ImageUploadSlot, file: File) => void;
};

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <path d="M4.5 17l4.5-4.5 4 4 3-3 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One explicit action per image in the live flow JSON. Missing images can be
 * uploaded and filled images stay visible so they can be replaced.
 */
export function ImageUploadSlots({
  slots,
  busySlotKey,
  error,
  disabled,
  onUpload,
}: ImageUploadSlotsProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedSlotRef = useRef<ImageUploadSlot | null>(null);

  if (slots.length === 0) return null;
  const missingCount = slots.filter((slot) => !slot.filled).length;
  const summary = missingCount > 0
    ? slots.length === 1
      ? t('codeEditor.images.needsOne')
      : t(missingCount === 1 ? 'codeEditor.images.needsOneOfMany' : 'codeEditor.images.needsMany', {
        missing: String(missingCount),
        total: String(slots.length),
      })
    : t('codeEditor.images.allFilled', { count: slots.length });

  const chooseFileFor = (slot: ImageUploadSlot) => {
    selectedSlotRef.current = slot;
    inputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const slot = selectedSlotRef.current;
    event.target.value = '';
    selectedSlotRef.current = null;
    if (file && slot) onUpload(slot, file);
  };

  return (
    <section
      className="flex flex-col gap-2.5 rounded border border-l-3 border-strong border-l-accent bg-surface-sunken px-3.5 py-3"
      aria-label={t('codeEditor.images.label')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,image/png"
        hidden
        onChange={handleFileSelected}
      />
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-13 font-semibold text-default">{t('codeEditor.images.title')}</span>
        <span className="text-12 text-subtle">{summary}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {slots.map((slot) => {
          const isUploading = busySlotKey === slot.key;
          const label = t(slot.filled ? 'codeEditor.images.replace' : 'codeEditor.images.upload', { number: slot.number });
          return (
            <Button
              key={slot.key}
              variant="secondary"
              size="sm"
              disabled={disabled || busySlotKey !== null}
              aria-label={label}
              startSlot={<ImageIcon />}
              onClick={() => chooseFileFor(slot)}
            >
              {isUploading ? t('codeEditor.images.uploading', { number: slot.number }) : label}
            </Button>
          );
        })}
      </div>
      {error ? (
        <div className="text-12 font-medium text-danger" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
