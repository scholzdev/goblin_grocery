// Automated smoke playtest against a running dev server (npm run dev).
// Usage: node tools/playtest.mjs [url] [width] [height]
// Uses the system Chrome via Playwright (no browser download). Saves screenshots to screenshots/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const W = Number(process.argv[3] ?? 1440), H = Number(process.argv[4] ?? 900);
const out = `screenshots/${W}x${H}`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });

const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const state = () => page.evaluate(() => { const s = window.__gg.store.state; return { phase: s.phase, wave: s.wave, hp: s.hp, money: s.money, kills: s.stats.kills }; });

await page.goto(url);
await page.waitForSelector('#title:not(.hidden)', { timeout: 20000 });
await wait(400);
await shot('01-title');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]');
await wait(2500);
await shot('02-wave1-start');
// Drive the cart around in a loop for a while.
const keys = ['d', 's', 'a', 'w'];
for (let i = 0; i < 8; i++) {
  await page.keyboard.down(keys[i % 4]);
  await wait(700);
  if (i === 3) await page.keyboard.press('Space');
  await page.keyboard.up(keys[i % 4]);
}
await shot('03-wave1-mid');
console.log('mid wave1', await state());
await page.keyboard.press('Tab');
await wait(300);
await shot('04-loadout');
await page.keyboard.press('Tab');
await page.keyboard.press('Escape');
await wait(300);
await shot('05-pause');
await page.keyboard.press('Escape');
await page.keyboard.press('F2');
await wait(500);
await shot('06-checkout');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
await wait(300);
await shot('07-shop');
console.log('shop', await state());
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
