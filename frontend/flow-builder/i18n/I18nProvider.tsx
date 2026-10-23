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

// ── i18n context ───────────────────────────────────────────────────────────
//
// One per builder instance. `useI18n()` gives components and hooks:
// - `t(key, params?)`: the message for a key, formatted (see format.ts);
// - `locale`: the host's locale, or `undefined` for the runtime default;
// - `formatDate` / `formatNumber`: Intl formatting in that locale.
//
// Plurals and numbers inside messages follow the catalogue's language: the
// host's `locale`, or English when the host gives none (the catalogue is then
// English too). Dates outside messages use the runtime default when no locale
// is given — what the app has always done.
//
// Out of scope: AI-generated flow content and the WhatsApp phone preview show
// the customer's own content and are not translated; RTL layout is a follow-up
// (the chrome uses physical `left`/`right`/`pl-`/`border-r` utilities, so under
// `dir="rtl"` text reads right but the rail, indicators and paddings stay on
// the left; nothing crashes).

import React, { createContext, useContext, useMemo } from 'react';
import { formatMessage, formatNumber as formatNumberIn, type MessageParams } from './format';
import { en } from './en';
import { lookupMessage, mergeMessages, type FlowBuilderMessagesOverride, type MessageKey } from './messages';

export type Translate = {
  (key: MessageKey, params?: MessageParams): string;
  /**
   * True when the host's catalogue changed this message from English. Present
   * on the `t` from `createI18n`; `describeError` uses it to decide whether
   * to show a translated message or the server's own text.
   */
  isOverridden?: (key: MessageKey) => boolean;
};

export type I18nValue = {
  locale: string | undefined;
  t: Translate;
  /** True when `messages` changed this key from English (same as `t.isOverridden`). */
  isOverridden: (key: MessageKey) => boolean;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number) => string;
};

export type FlowBuilderI18nOptions = {
  /** BCP 47 tag, e.g. `de` or `pt-BR`. Defaults to the runtime's locale for dates and English for messages. */
  locale?: string;
  /** Overrides for any messages; anything missing falls back to English. */
  messages?: FlowBuilderMessagesOverride;
};

export function createI18n({ locale, messages }: FlowBuilderI18nOptions = {}): I18nValue {
  const catalogue = mergeMessages(messages);
  const messageLocale = locale ?? 'en';
  const isOverridden = (key: MessageKey) => lookupMessage(catalogue, key) !== lookupMessage(en, key);
  const t: Translate = (key, params) => formatMessage(messageLocale, lookupMessage(catalogue, key), params);
  t.isOverridden = isOverridden;
  return {
    locale,
    t,
    isOverridden,
    formatDate: (value, options) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat(locale, options).format(date);
    },
    formatNumber: (value) => formatNumberIn(messageLocale, value),
  };
}

// English, so pure helpers and tests that render a piece of UI without the
// provider still read correctly.
const I18nContext = createContext<I18nValue>(createI18n());

export function I18nProvider({ locale, messages, children }: FlowBuilderI18nOptions & { children: React.ReactNode }) {
  const value = useMemo(() => createI18n({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Shorthand for components that only need `t`. */
export function useT(): Translate {
  return useI18n().t;
}


export type { MessageParams };
