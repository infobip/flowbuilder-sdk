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

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { cx } from '../../utils/cx';
import { CONTROL_CLASS, controlToneClass } from './Field';
import {
  findIndexByPrefix,
  indexOfValue,
  labelForValue,
  stepActiveIndex,
  type SelectOption,
} from './selectMenu';

export type { SelectOption };

export type SelectSize = 'md' | 'sm';

export type SelectProps<T extends string> = {
  options: ReadonlyArray<SelectOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * `sm` is sized to sit beside 36px pager buttons: shorter trigger and
   * options, 13px text and a light border. Defaults to the 44px form-control size.
   */
  size?: SelectSize;
  /** Open the menu upwards, for a select with nothing below it. Defaults to `bottom`. */
  menuPlacement?: 'bottom' | 'top';
  className?: string;
};

const TRIGGER_SIZE_CLASSES: Record<SelectSize, string> = {
  md: 'min-h-target px-3 py-2.5',
  sm: 'min-h-9 px-2.5 text-13',
};

function triggerToneClass(size: SelectSize, open: boolean): string {
  // The small size keeps its light border even while open or focused; only
  // the ring shows it is active.
  if (size === 'sm') return cx('border-default focus-visible:ring-focus-ring', open && 'ring-2 ring-focus-ring');
  return open ? 'border-focus-ring ring-2 ring-focus-ring' : controlToneClass(false);
}

function optionClassName(size: SelectSize, selected: boolean, active: boolean): string {
  return cx(
    'flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-default cursor-pointer',
    size === 'sm' ? 'min-h-8.5' : 'min-h-10',
    selected && 'font-semibold shadow-[inset_2px_0_0_var(--fb-color-accent)]',
    active && (selected ? 'bg-accent-soft' : 'bg-surface-sunken'),
  );
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  size = 'md',
  menuPlacement = 'bottom',
  className,
}: SelectProps<T>) {
  const t = useT();
  const listboxId = useId();
  const optionIdPrefix = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ query: '', timer: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => indexOfValue(options, value));

  const selectedIndex = indexOfValue(options, value);
  const selectedLabel = labelForValue(options, value, placeholder ?? t('common.select.placeholder'));
  const activeOption = options[activeIndex];
  const activeId = activeOption ? `${optionIdPrefix}-${activeOption.value}` : undefined;

  const close = useCallback(() => setOpen(false), []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      onChange(option.value);
      setOpen(false);
    },
    [onChange, options],
  );

  useEffect(() => {
    if (open) setActiveIndex(indexOfValue(options, value));
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const option = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [close, open]);

  useEffect(() => () => window.clearTimeout(typeaheadRef.current.timer), []);

  const appendTypeahead = (key: string) => {
    const char = key.toLowerCase();
    window.clearTimeout(typeaheadRef.current.timer);
    const previous = typeaheadRef.current.query;
    typeaheadRef.current.query = previous === char ? char : previous + char;
    setActiveIndex((current) => findIndexByPrefix(options, typeaheadRef.current.query, current));
    typeaheadRef.current.timer = window.setTimeout(() => {
      typeaheadRef.current.query = '';
    }, 500);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(event.key === 'ArrowUp' ? options.length - 1 : selectedIndex);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => stepActiveIndex(current, 1, options.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => stepActiveIndex(current, -1, options.length));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      appendTypeahead(event.key);
    }
  };

  return (
    <div ref={rootRef} className={cx('relative min-w-0', open && 'z-5', className)}>
      <button
        type="button"
        className={cx(
          CONTROL_CLASS,
          'flex min-w-0 items-center justify-between gap-3 text-left cursor-pointer',
          TRIGGER_SIZE_CLASSES[size],
          triggerToneClass(size, open),
        )}
        aria-label={`${ariaLabel}, ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? activeId : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <span
          className={cx(
            'inline-flex flex-none transition-[rotate,color] motion-reduce:transition-none',
            open ? 'rotate-180 text-default' : 'text-subtle',
          )}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.4 4.2 6 7.8l3.6-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          ref={listRef}
          id={listboxId}
          className={cx(
            'absolute inset-x-0 z-40 max-h-[min(380px,calc(var(--fb-vh,100vh)*0.7))] overflow-auto rounded border-2 border-strong bg-surface-raised p-1',
            menuPlacement === 'top' ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]',
            size === 'sm' && 'text-13',
          )}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <div
                key={option.value}
                id={`${optionIdPrefix}-${option.value}`}
                role="option"
                aria-selected={selected}
                data-active={active ? 'true' : undefined}
                className={optionClassName(size, selected, active)}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected ? <span className="flex-none text-13 font-bold text-accent" aria-hidden="true">✓</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
