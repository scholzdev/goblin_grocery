// Shared by every browser tool: resolve the game URL, starting a private Vite dev server on a free port when none is given.
// `await devUrl(process.argv[2])` -> the argument if it is an http(s) URL, else $GG_URL, else a fresh dev server (stopped on process exit).
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

/** Start `vite` on `port` (free port by default). Resolves { url, stop }; the child is also killed when this process exits. */
export async function startDev(port) {
  port ??= await freePort();
  const child = spawn(process.execPath, [VITE, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  let dead = false;
  child.once('exit', () => { dead = true; });
  const stop = () => { if (!dead) child.kill(); };
  process.once('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { stop(); process.exit(130); });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 150; i++) {
    if (dead) throw new Error(`vite exited early:\n${err}`);
    try { if ((await fetch(url)).ok) { child.unref(); child.stderr.destroy(); return { url, stop }; } } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  stop();
  throw new Error(`vite did not come up on ${url}\n${err}`);
}

let started;
/** `suffix` (e.g. '?bot=1') is appended only to a URL we start ourselves; a given URL is used as is. */
export async function devUrl(arg, suffix = '') {
  if (arg && /^https?:\/\//.test(arg)) return arg;
  if (process.env.GG_URL) return process.env.GG_URL;
  started ??= startDev();
  return (await started).url + suffix;
}
