/** Restart on app edits; connected browsers reload when the server returns. */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
let child;
let timer;
let restartRequested = false;
let stopping = false;

function start() {
  restartRequested = false;
  child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.PORT ?? '9999', FORMA_DEV: '1' },
  });
  child.on('error', (error) => console.error(`Could not launch Forma: ${error.message}`));
  child.on('exit', (code) => {
    child = undefined;
    if (stopping) return;
    if (restartRequested) start();
    else if (code) console.error('Server stopped. Save an app file to retry.');
  });
}

const watcher = watch(root, { recursive: true }, (_event, filename) => {
  if (!filename || stopping) return;
  const path = filename.split(sep).join('/');
  if (path.split('/').some((part) => part.startsWith('.') || part === 'node_modules')) return;
  if (!/^(?:[^/]+\.html|package\.json|(?:css|js|assets|data|server)\/.*)$/.test(path)) return;
  if (/(?:~|\.sw[op]|\.tmp)$/.test(path)) return;

  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`Reloading after ${path}`);
    restartRequested = true;
    if (child) child.kill();
    else start();
  }, 150);
});

function stop() {
  stopping = true;
  clearTimeout(timer);
  watcher.close();
  child?.kill();
}

watcher.on('error', (error) => {
  console.error(`Could not watch app files: ${error.message}`);
  process.exitCode = 1;
  stop();
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);

console.log('Watching app files; browser reload is enabled.');
start();
