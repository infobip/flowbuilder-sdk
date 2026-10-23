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

// Test runner for the Flow Builder frontend, the flow validator it uses and the
// server handler.
//
// The repo has no test framework, and Node's ESM loader can't resolve the
// extensionless relative imports the frontend uses (that's the bundler's job).
// So we bundle each `*.test.ts` under `frontend/flow-builder/`, `src/` and `server/` with
// esbuild (inlining shared deps + React), then run them through Node's built-in
// test runner. Keeps the tests self-contained with zero new dependencies.

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const testDirs = [join(root, 'frontend', 'flow-builder'), join(root, 'src'), join(root, 'server')];

function findTestFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findTestFiles(full));
    else if (entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const testFiles = testDirs.flatMap(findTestFiles);
if (testFiles.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const outDir = mkdtempSync(join(tmpdir(), 'flowbuilder-tests-'));
let exitCode = 0;

try {
  await build({
    entryPoints: testFiles,
    outdir: outDir,
    outbase: root,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"test"' },
    // CommonJS deps bundled into ESM (Express, for the server tests) still
    // `require()` Node built-ins; give the bundle a real `require` for them.
    banner: { js: "import { createRequire as __fbCreateRequire } from 'node:module'; const require = __fbCreateRequire(import.meta.url);" },
  });

  const compiled = testFiles.map((file) => join(outDir, relative(root, file).replace(/\.ts$/, '.js')));

  // Tests find their sources from the cwd, so pin it to the repo root.
  const child = spawn(process.execPath, ['--test', ...compiled], { stdio: 'inherit', cwd: root });
  exitCode = await new Promise((resolve) => child.on('close', resolve)) ?? 0;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

process.exit(exitCode);
