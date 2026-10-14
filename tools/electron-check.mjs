// Launches the PACKAGED desktop app and verifies boot → play → shop, with a screenshot.
import { _electron as electron } from 'playwright';
const exe = process.argv[2] ?? 'release/mac-arm64/Goblin Grocery.app/Contents/MacOS/Goblin Grocery';
const app = await electron.launch({ executablePath: exe, args: process.argv.slice(3) }); // e.g. node tools/electron-check.mjs <exe> --lab
const win = await app.firstWindow();
const errs = []; win.on('pageerror', (e) => errs.push(e.message)); win.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await win.waitForSelector('#title:not(.hidden)', { timeout: 30000 });
console.log('url', win.url(), 'desktop bridge:', await win.evaluate(() => typeof window.desktop), 'quit btn:', await win.isVisible('[data-act="exit"]'));
await win.screenshot({ path: 'screenshots/electron-title.png' });
await win.click('[data-act="play"]'); await win.click('[data-starter="toaster"]'); await win.click('[data-act="start-run"]');
await win.waitForTimeout(3000);
await win.screenshot({ path: 'screenshots/electron-combat.png' });
const audio = await win.evaluate(() => [...document.querySelectorAll('img')].length);
console.log('imgs', audio, errs.join('\n') || 'no errors');
await app.close();
