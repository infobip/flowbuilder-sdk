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

// Helpers for checking a compiled stylesheet's scoping (theme.test.ts on the
// Tailwind compile, distCss.test.ts on the shipped dist/styles.css).

export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every style rule's selector in `css`, with the at-rules it's nested in. */
export function styleRules(css: string): Array<{ selector: string; within: string[] }> {
  const rules: Array<{ selector: string; within: string[] }> = [];
  const stack: string[] = [];
  let text = '';
  for (const ch of stripComments(css)) {
    if (ch === '{') {
      const head = text.trim();
      text = '';
      if (!head.startsWith('@')) rules.push({ selector: head, within: [...stack] });
      stack.push(head);
    } else if (ch === '}') {
      stack.pop();
      text = '';
    } else if (ch === ';') {
      text = '';
    } else {
      text += ch;
    }
  }
  return rules;
}

/** Splits a selector list on its top-level commas (not those inside :is(), or escaped in a class name). */
export function selectorList(selector: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === '\\') { current += ch + (selector[i + 1] ?? ''); i += 1; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; } else current += ch;
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

export const ROOT_SELECTOR = /^(?::is\()?\[data-flowbuilder-root\]|^:host\b/;
