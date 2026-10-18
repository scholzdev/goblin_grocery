// DEV: F4 stress (70 enemies + 150 projectiles) on top of a developed build; samples actualFps.
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(await devUrl(process.argv[2]));
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(500);
await page.keyboard.press('F3'); await page.waitForTimeout(2500);
await page.keyboard.press('F4'); await page.waitForTimeout(1500);
const samples = [];
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(500);
  samples.push(await page.evaluate(() => ({ fps: Math.round(window.__gg.game.loop.actualFps), enemies: window.__arena.enemies.filter((e) => e.alive).length, shots: window.__arena.arsenal.activeShots })));
}
console.table(samples);
await b.close();
