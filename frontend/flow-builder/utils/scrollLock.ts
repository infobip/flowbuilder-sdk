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

// ── Body scroll lock ───────────────────────────────────────────────────────
//
// Reference-counted, so stacked dialogs (or two builders on one page) don't
// fight: the first lock saves `body.style.overflow` and hides it, and only the
// last release restores what was there. Only the "page" layout uses it — an
// embedded builder ("fill") must leave the host page's scrolling alone.

type LockState = { count: number; previous: string };

const locks = new WeakMap<Document, LockState>();

/** Lock the document body's scrolling. Returns the release function (idempotent). */
export function lockBodyScroll(doc: Document): () => void {
  let state = locks.get(doc);
  if (!state) {
    state = { count: 0, previous: '' };
    locks.set(doc, state);
  }
  if (state.count === 0) {
    state.previous = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
  }
  state.count += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = locks.get(doc);
    if (!current) return;
    current.count -= 1;
    if (current.count === 0) {
      doc.body.style.overflow = current.previous;
      locks.delete(doc);
    }
  };
}
