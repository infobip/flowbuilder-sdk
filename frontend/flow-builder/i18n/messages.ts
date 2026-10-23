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

// ── Message catalogue types ────────────────────────────────────────────────
//
// `en` (i18n/en/) is the typed source of every user-facing string. A host
// passes `messages`, a deep-partial copy of it, and anything it leaves out
// falls back to English. Keys are dotted paths grouped by area (`library.*`,
// `editor.*`, `codeEditor.*`, `preview.*`, `settings.*`, `notices.*` for
// outcomes the editor reports, `errors.*`, `validation.*`, and
// `common.*` for words several areas share and the app chrome).
//
// Writing a message: plain text, `{name}` for a value, and
// `{count|one:# flow|other:# flows}` for plurals (see format.ts). Never build a
// sentence by joining messages — word order differs between languages; give
// the whole sentence one key with placeholders instead.

import { en } from './en';

export type FlowBuilderMessages = typeof en;

/** Every message, optional at every level: what a host passes as `messages`. */
export type FlowBuilderMessagesOverride = {
  [K in keyof FlowBuilderMessages]?: DeepPartial<FlowBuilderMessages[K]>;
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** A dotted path to one message, e.g. `library.title`. */
export type MessageKey = Leaves<FlowBuilderMessages>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Copies `override` over `base`, keeping only string leaves at paths `base`
// has, so a typo or a wrong shape in a host's catalogue can't hide English.
function mergeInto(base: Record<string, unknown>, override: unknown): Record<string, unknown> {
  if (!isPlainObject(override)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, baseValue] of Object.entries(base)) {
    const value = override[key];
    if (typeof baseValue === 'string') {
      if (typeof value === 'string') out[key] = value;
    } else if (isPlainObject(baseValue)) {
      out[key] = mergeInto(baseValue, value);
    }
  }
  return out;
}

export function mergeMessages(override: FlowBuilderMessagesOverride | undefined): FlowBuilderMessages {
  return mergeInto(en, override) as FlowBuilderMessages;
}

/** Looks up a dotted key; unknown keys return the key itself so they show up in the UI. */
export function lookupMessage(messages: FlowBuilderMessages, key: MessageKey): string {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (!isPlainObject(node)) return key;
    node = node[part];
  }
  return typeof node === 'string' ? node : key;
}
