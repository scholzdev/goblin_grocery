// Desktop app launcher. Usage: npm run app:dev [-- --lab]   Electron on a private Vite dev server (hot reload, dev keys on)
//                              npm run app [-- --lab]       build the packaged app, quit a running copy, open the fresh one
// --lab opens the in-game Test Lab; for the packaged app it also bakes in VITE_DEV_KEYS=1 (normal builds strip dev keys).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { startDev } from './lib/dev.mjs';

const [mode, ...flags] = process.argv.slice(2);
const lab = flags.includes('--lab');
const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (mode === 'dev') {
  const { url, stop } = await startDev();
  console.log(`dev server ${url}`);
  const electron = (await import('electron')).default;
  const child = spawn(electron, ['.', ...(lab ? ['--lab'] : [])], { stdio: 'inherit', env: { ...process.env, GG_DEV_URL: url } });
  child.once('exit', (code) => { stop(); process.exit(code ?? 0); });
} else if (mode === 'packaged') {
  const dir = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
  const app = `release/${dir}/Goblin Grocery.app`;
  if (process.platform !== 'darwin') { console.error('npm run app opens the macOS bundle; use `npm run app:dev` here, or `npm run dist:win|dist:linux`.'); process.exit(1); }
  spawnSync('osascript', ['-e', 'quit app "Goblin Grocery"'], { stdio: 'ignore' });
  run('npm', ['run', 'build'], lab ? { VITE_DEV_KEYS: '1' } : {});
  run('npx', ['electron-builder', '--mac', 'dir'], { CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
  if (!existsSync(app)) { console.error(`expected ${app}`); process.exit(1); }
  run('open', [app, ...(lab ? ['--args', '--lab'] : [])]);
} else {
  console.error('usage: node tools/app.mjs <dev|packaged> [--lab]');
  process.exit(1);
}
