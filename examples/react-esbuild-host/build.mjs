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

// Bundles the host app with esbuild. The SDK's stylesheet is imported like any
// other CSS file; its relative `./fonts/*.woff2` URLs are emitted as hashed
// assets by the `file` loader, so the fonts resolve from this app's own origin.

import { build } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(here, 'src/main.tsx')],
  outdir: dist,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  minify: true,
  sourcemap: true,
  loader: { '.woff2': 'file' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
  // Resolve react from here so the example and the SDK share one copy.
  nodePaths: [join(here, 'node_modules')],
});

copyFileSync(join(here, 'index.html'), join(dist, 'index.html'));
