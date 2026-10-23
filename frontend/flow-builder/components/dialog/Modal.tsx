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

import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../button/IconButton';
import { useT } from '../../i18n/I18nProvider';
import { useInstance } from '../../app/instanceContext';
import { lockBodyScroll } from '../../utils/scrollLock';
import { cx } from '../../utils/cx';

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Footer actions (buttons). */
  footer?: React.ReactNode;
  /** Allow closing via Escape / overlay click. Defaults to true. */
  dismissable?: boolean;
  children?: React.ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// The focused element as seen from `node`'s document or shadow root, so the
// focus trap keeps working when the builder renders inside a shadow root.
function activeElementOf(node: Node | null): Element | null {
  const root = node?.getRootNode() as Document | ShadowRoot | undefined;
  return root && 'activeElement' in root ? root.activeElement : document.activeElement;
}

// Accessible modal dialog rendered through a portal into this builder
// instance's root. Handles Escape-to-close, overlay-click-to-close, initial
// focus, a simple focus trap, and restoring focus to the previously focused
// element on unmount.
//
// Layout "page" (the builder owns the window): a fixed overlay over the
// viewport, and the body's scrolling is locked while open. Layout "fill" (the
// builder is embedded in a host's container): the overlay covers only the
// builder's root, and the host page's scrolling is left alone.
export function Modal({ open, title, onClose, footer, dismissable = true, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const t = useT();
  const { getRoot, layout, lockBodyScroll: shouldLockBodyScroll } = useInstance();

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && dismissable) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const active = activeElementOf(dialog);
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === active,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissable, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    previouslyFocused.current = activeElementOf(dialog ?? getRoot()) as HTMLElement | null;
    const target = dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
    target?.focus();
    const release = shouldLockBodyScroll ? lockBodyScroll(document) : null;
    return () => {
      release?.();
      previouslyFocused.current?.focus?.();
    };
  }, [open, getRoot, shouldLockBodyScroll]);

  if (!open || typeof document === 'undefined') return null;

  // Keep the portal inside this instance's themed root (`data-flowbuilder-root`)
  // so the modal inherits its light/dark CSS variables — and lands in the right
  // builder when there are several on the page.
  const portalTarget = getRoot() ?? document.body;
  const fill = layout === 'fill';

  return createPortal(
    <div
      className={cx(fill ? 'absolute' : 'fixed', 'inset-0 z-1000 grid place-items-center bg-overlay p-6')}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        // Keeps the browser from moving focus to <body> first, so closing
        // returns focus to the opener like Escape and Cancel do.
        event.preventDefault();
        if (dismissable) onClose();
      }}
    >
      <div
        ref={dialogRef}
        // `--fb-vh` is the root's height in layout "fill"; unset in "page".
        className="max-h-[calc(var(--fb-vh,100vh)-48px)] w-full max-w-[460px] overflow-auto rounded border-2 border-strong bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4.5 pb-2">
          <h2 className="text-17 font-semibold text-default" id={titleId}>{title}</h2>
          {dismissable && (
            <IconButton label={t('common.dialog.close')} onClick={onClose}>
              <span className="text-18 leading-none">×</span>
            </IconButton>
          )}
        </div>
        <div className="px-5 pt-1 pb-2 text-muted">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 px-5 pt-4 pb-5">{footer}</div>}
      </div>
    </div>,
    portalTarget,
  );
}
