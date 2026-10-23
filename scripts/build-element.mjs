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

// Builds the web component: `dist/element/index.js` (ESM, React external, for
// bundler users) and `dist/element/standalone.js` (React inlined, minified,
// registers <infobip-flow-builder> on load). Both embed the library stylesheet
// `dist/styles.css` as a string, so run `scripts/build-lib.mjs` first; the
// `build:element` npm script does.
//
// Fonts: the element injects its @font-face rules into `document`, where a
// relative URL would resolve against the host page, not this script. So the
// `url(./fonts/x.woff2)` URLs in the embedded CSS are replaced, at build time,
// with `new URL('../fonts/x.woff2', import.meta.url).href`. Both outputs sit in
// `dist/element/` next to `dist/fonts/`, and both are ES modules, so the fonts
// are found next to the script wherever it is served from; the literal
// `new URL(…, import.meta.url)` form is one bundlers (Vite, webpack, esbuild)
// recognise and turn into an emitted asset.

import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cssModuleSource } from './css-module.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const css = `${root}dist/styles.css`;
if (!existsSync(css)) {
  console.error('dist/styles.css is missing; run `node scripts/build-lib.mjs` first.');
  process.exit(1);
}
mkdirSync(`${root}dist/element`, { recursive: true });

// `element/compiledCss.ts` imports the standalone app's frontend/app.css; the
// element build swaps in the library stylesheet instead.
const libraryCss = {
  name: 'library-css',
  setup(b) {
    b.onLoad({ filter: /element[\\/]compiledCss\.ts$/ }, () => ({
      contents: cssModuleSource(readFileSync(css, 'utf8')),
      loader: 'js',
    }));
  },
};

const shared = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'transform',
  plugins: [libraryCss],
  logLevel: 'info',
};

// `process.env.NODE_ENV` stays undefined in index.js (a bundler user's own
// bundler decides); standalone.js inlines React, so it is production there.
await build({
  ...shared,
  entryPoints: [`${root}frontend/flow-builder/element/index.ts`],
  outfile: `${root}dist/element/index.js`,
  external: ['react', 'react-dom', 'react-dom/*', 'react/*'],
  sourcemap: true,
});

await build({
  ...shared,
  entryPoints: [`${root}frontend/flow-builder/element/standalone.ts`],
  outfile: `${root}dist/element/standalone.js`,
  minify: true,
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});

for (const file of ['index.js', 'standalone.js']) {
  console.log(`dist/element/${file}: ${(statSync(`${root}dist/element/${file}`).size / 1024).toFixed(1)} kB`);
}
