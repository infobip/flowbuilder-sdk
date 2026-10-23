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

// Bundle-size budget: fails when the gzip size of a shipped file is over its
// budget. Budgets sit ~15% above the sizes measured at 1.0.0-rc.1; raise one
// on purpose, in the same change that grows the bundle.
// Run after `npm run build` (`npm run check:size`).

import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const BUDGETS_KB = {
  'dist/react/index.js': 88,
  'dist/element/standalone.js': 148,
  'dist/styles.css': 14,
};

let failed = false;
for (const [file, budget] of Object.entries(BUDGETS_KB)) {
  let raw;
  try {
    raw = readFileSync(`${root}${file}`);
  } catch {
    console.error(`${file} is missing; run \`npm run build\` first.`);
    process.exit(1);
  }
  const gzip = gzipSync(raw, { level: 9 }).length / 1024;
  const ok = gzip <= budget;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file}: ${(raw.length / 1024).toFixed(1)} kB raw, ${gzip.toFixed(1)} kB gzip (budget ${budget} kB)`);
}
process.exit(failed ? 1 : 0);
