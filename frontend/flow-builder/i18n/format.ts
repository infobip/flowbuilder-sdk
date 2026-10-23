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

// ── Message formatting ─────────────────────────────────────────────────────
//
// The catalogue's strings use two pieces of syntax, kept deliberately small so
// translators don't need an ICU toolchain:
//
//   {name}                 replaced with `params.name`
//   {count|one:# flow|other:# flows}
//                          picks a branch with Intl.PluralRules for the locale
//                          (`zero`, `one`, `two`, `few`, `many`, `other`, or an
//                          exact `=0` / `=1` …), then replaces `#` with the
//                          number formatted for the locale
//
// Placeholders without a matching param are left as written, so a missing
// value is visible rather than silently blank.

export type MessageParams = Record<string, string | number>;

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function pluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

export function formatNumber(locale: string, value: number): string {
  let format = numberFormatCache.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    numberFormatCache.set(locale, format);
  }
  return format.format(value);
}

// Splits `one:# flow|other:# flows` on the `|` that start a new branch.
function parseBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>();
  for (const part of body.split('|')) {
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    branches.set(part.slice(0, colon).trim(), part.slice(colon + 1));
  }
  return branches;
}

function formatPlural(locale: string, value: number, body: string): string | null {
  const branches = parseBranches(body);
  const branch = branches.get(`=${value}`) ?? branches.get(pluralRules(locale).select(value)) ?? branches.get('other');
  if (branch == null) return null;
  return branch.replace(/#/g, formatNumber(locale, value));
}

// `{name}` or `{name|…}`; the body may not contain braces.
const PLACEHOLDER = /\{(\w+)(?:\|([^{}]*))?\}/g;

export function formatMessage(locale: string, template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (whole, name: string, body: string | undefined) => {
    const value = params[name];
    if (value === undefined) return whole;
    if (body !== undefined) {
      const count = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(count)) return whole;
      return formatPlural(locale, count, body) ?? whole;
    }
    return typeof value === 'number' ? formatNumber(locale, value) : value;
  });
}
