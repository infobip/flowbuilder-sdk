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

// Prepares the examples: packs the library (`npm pack`, a local tarball, never
// published) and unpacks it into each example's node_modules, exactly as a
// customer would get it from their registry. react, react-dom, express and
// dotenv are symlinked from the repo's node_modules (no network needed). Then
// it builds the examples that have a build step (react-esbuild-host → dist/).
//
// Run `npm run build` first; `npm run examples:prepare` does both.

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const examples = ['express-host', 'react-esbuild-host', 'html-host'];
const shared = ['react', 'react-dom', 'express', 'dotenv'];

const work = mkdtempSync(join(tmpdir(), 'flowbuilder-pack-'));
try {
  execFileSync('npm', ['pack', '--pack-destination', work, '--silent'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  const tarball = readdirSync(work).find((file) => file.endsWith('.tgz'));
  execFileSync('tar', ['-xzf', join(work, tarball), '-C', work]);
  console.log(`packed ${tarball}`);

  for (const name of examples) {
    const modules = join(root, 'examples', name, 'node_modules');
    const target = join(modules, '@infobip', 'flowbuilder-sdk');
    rmSync(modules, { recursive: true, force: true });
    mkdirSync(join(modules, '@infobip'), { recursive: true });
    cpSync(join(work, 'package'), target, { recursive: true });
    for (const dep of shared) {
      const source = join(root, 'node_modules', dep);
      if (existsSync(source)) symlinkSync(source, join(modules, dep), 'dir');
    }
    console.log(`examples/${name}/node_modules/@infobip/flowbuilder-sdk`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const name of examples) {
  const script = join(root, 'examples', name, 'build.mjs');
  if (!existsSync(script)) continue;
  execFileSync(process.execPath, [script], { cwd: join(root, 'examples', name), stdio: 'inherit' });
  console.log(`examples/${name}: built`);
}
