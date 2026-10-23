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

// Watch-mode frontend build: the Tailwind CLI rebuilds `frontend/app.css` and
// esbuild rebuilds `frontend/app.js`, side by side in one terminal. Both keep
// watching when this script's stdin closes (IDE tasks, process managers).
// Ctrl+C / SIGTERM / SIGHUP stops both and exits 0; if the CSS watcher dies,
// esbuild is stopped too and the script exits non-zero.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const tailwindPkg = require.resolve('@tailwindcss/cli/package.json');
const tailwindCli = join(dirname(tailwindPkg), require(tailwindPkg).bin.tailwindcss);

// Node runs the CLI's own entry script directly, so no shell or `.cmd` shim is
// involved. Its stdin is a pipe only this script holds: `--watch` exits when
// stdin closes, so the watcher can't outlive this script however it dies
// (SIGKILL included). Its own process group on POSIX, so a terminal Ctrl+C
// reaches only this script, which then stops it — rather than racing it to
// the signal.
const tailwind = spawn(
  process.execPath,
  [tailwindCli, '-i', 'frontend/flow-builder/styles/app.css', '-o', 'frontend/app.css', '--watch'],
  { stdio: ['pipe', 'inherit', 'inherit'], detached: process.platform !== 'win32' },
);
tailwind.stdin.on('error', () => {}); // EPIPE once the watcher has exited
const tailwindRunning = () => tailwind.exitCode === null && tailwind.signalCode === null;

let stopping = false;
const js = esbuild.context({
  entryPoints: ['frontend/main.tsx'],
  bundle: true,
  outfile: 'frontend/app.js',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
});

async function stop(code) {
  if (stopping) return;
  stopping = true;
  tailwind.stdin.end();
  if (tailwindRunning()) tailwind.kill('SIGTERM');
  const context = await js.catch(() => null);
  await context?.dispose();
  process.exit(code);
}

tailwind.on('exit', (code, signal) => {
  if (stopping) return;
  console.error(`tailwindcss watcher stopped (${signal ?? `exit ${code}`}); stopping esbuild.`);
  void stop(code || 1);
});
tailwind.on('error', (error) => {
  console.error(error.message);
  void stop(1);
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => void stop(0));
process.on('exit', () => {
  if (tailwindRunning()) tailwind.kill('SIGTERM');
});

try {
  await (await js).watch();
} catch (error) {
  if (!stopping) {
    console.error(error instanceof Error ? error.message : error);
    await stop(1);
  }
}
