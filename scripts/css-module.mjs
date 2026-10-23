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

// Turns the library stylesheet into a JS module for the element build
// (see build-element.mjs for why the font URLs are resolved at runtime).

/** JS source of a module whose default export is the stylesheet, with its font URLs resolved at runtime. */
export function cssModuleSource(cssText) {
  const parts = [];
  let last = 0;
  for (const match of cssText.matchAll(/url\(\.\/fonts\/([\w.-]+\.woff2)\)/g)) {
    parts.push(JSON.stringify(cssText.slice(last, match.index)));
    parts.push(`"url(" + new URL(${JSON.stringify(`../fonts/${match[1]}`)}, import.meta.url).href + ")"`);
    last = match.index + match[0].length;
  }
  parts.push(JSON.stringify(cssText.slice(last)));
  return `export default ${parts.join(' + ')};`;
}
