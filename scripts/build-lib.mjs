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

// Library build: what `npm publish` would ship besides the server and the
// element (build-element.mjs), written to `dist/`:
//
//   dist/react/index.js   the React entry (ESM, React external, sourcemap)
//   dist/styles.css       the Tailwind compile of styles/app.css, minified
//   dist/fonts/*.woff2    the fonts styles.css points at
//
// `process.env.NODE_ENV` is deliberately not defined here: nothing in the
// builder's own code reads it, and React is external, so the host's bundler
// decides for React.
//
// Fonts: fonts.css uses the standalone app's `/frontend/assets/fonts/…` URLs
// (server.js serves them). The shipped stylesheet gets relative
// `./fonts/<file>.woff2` URLs instead, so the host's bundler resolves them
// next to styles.css. The rewrite happens here, on the compiled CSS.

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const require = createRequire(import.meta.url);
const tailwindPkg = require.resolve('@tailwindcss/cli/package.json');
const tailwindCli = join(dirname(tailwindPkg), require(tailwindPkg).bin.tailwindcss);

mkdirSync(join(dist, 'react'), { recursive: true });
mkdirSync(join(dist, 'fonts'), { recursive: true });

await build({
  entryPoints: [join(root, 'frontend/flow-builder/public/index.ts')],
  outfile: join(dist, 'react/index.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'transform',
  external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
  sourcemap: true,
  logLevel: 'info',
});

// Tailwind compile, then the font rewrite.
const tmp = join(tmpdir(), `flowbuilder-styles-${process.pid}.css`);
execFileSync(
  process.execPath,
  [tailwindCli, '-i', join(root, 'frontend/flow-builder/styles/app.css'), '-o', tmp, '--minify'],
  { stdio: ['ignore', 'inherit', 'inherit'], cwd: root },
);
const compiled = readFileSync(tmp, 'utf8');
rmSync(tmp, { force: true });

const FONT_URL = /url\((['"]?)\/frontend\/assets\/fonts\/([\w.-]+\.woff2)\1\)/g;
const css = compiled.replace(FONT_URL, 'url(./fonts/$2)');
if (css.includes('/frontend/assets')) {
  console.error('dist/styles.css still points at /frontend/assets; the font rewrite missed a URL.');
  process.exit(1);
}
// An absolute `url(/...)` can't be resolved by a customer's bundler (esbuild,
// Vite and webpack all fail the build), so nothing but the relative fonts may be linked.
const absoluteUrl = /url\(\s*['"]?\/(?!\/)/.exec(css);
if (absoluteUrl) {
  console.error(`dist/styles.css links an absolute URL (${css.slice(absoluteUrl.index, absoluteUrl.index + 40)}…); customers' bundlers can't resolve it.`);
  process.exit(1);
}
writeFileSync(join(dist, 'styles.css'), css);

const fontDir = join(root, 'frontend/assets/fonts');
// The fonts ship with their SIL Open Font License text (OFL.txt), which must travel with them.
for (const file of readdirSync(fontDir).filter((f) => f.endsWith('.woff2') || f === 'OFL.txt')) {
  copyFileSync(join(fontDir, file), join(dist, 'fonts', file));
}

for (const file of ['react/index.js', 'styles.css']) {
  console.log(`dist/${file}: ${(statSync(join(dist, file)).size / 1024).toFixed(1)} kB`);
}
