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

// ── Rich messages ──────────────────────────────────────────────────────────
//
// For a message that wraps a value in markup, e.g. `Delete {name}?` with the
// name in <strong>. The whole sentence stays one catalogue key, so translators
// can reorder the pieces; the placeholders are replaced by React nodes.

import React from 'react';

/**
 * Splits `template` around `{name}` placeholders and puts `values[name]` in
 * their place. Text between them stays a string. A placeholder with no value
 * is left as written, like `formatMessage` does.
 */
export function formatRich(template: string, values: Record<string, React.ReactNode>): React.ReactNode[] {
  return template.split(/\{(\w+)\}/).flatMap((part, index): React.ReactNode[] => {
    // `split` with a capture group alternates text and placeholder names.
    if (index % 2 === 0) return part === '' ? [] : [part];
    if (!(part in values)) return [`{${part}}`];
    return [<React.Fragment key={index}>{values[part]}</React.Fragment>];
  });
}
