// Screenshots at several aspect ratios: title, combat, shop. Checks for letterbox bars.
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome' });
for (const [W, H] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [2560, 1080]]) {
  const page = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(await devUrl(process.argv[2]));
  await page.waitForSelector('#title:not(.hidden)');
  await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(2200);
  await page.screenshot({ path: `screenshots/aspect-${W}x${H}-combat.png` });
  await page.keyboard.press('F2'); await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 }); await page.waitForTimeout(200);
  await page.screenshot({ path: `screenshots/aspect-${W}x${H}-shop.png` });
  const canvas = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.width, c.height]; });
  console.log(W, H, 'canvas', canvas, errs.join(';') || 'ok');
  await page.close();
}
await b.close();
