// DEV: jump to the boss with a developed build and capture combat frames.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]');
await page.waitForTimeout(800);
await page.keyboard.press('F3');
for (let i = 0; i < 6; i++) {
  await page.keyboard.down(i % 2 ? 'a' : 'd');
  await page.waitForTimeout(1200);
  await page.keyboard.up(i % 2 ? 'a' : 'd');
  await page.screenshot({ path: `screenshots/boss-${i}.png` });
}
console.log(await page.evaluate(() => ({ fps: window.__gg.game.loop.actualFps, s: window.__gg.store.state.hp, enemies: window.__arena.enemies.length })));
console.log(errors.join('\n') || 'no errors');
await browser.close();
