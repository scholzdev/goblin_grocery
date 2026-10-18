// DEV: shop with a fresh and a spoiled Avocado and Fresh Fish side by side, plus Basil and Scoby: the cart art switches to the `_rotten` icons.
// Usage: node tools/perishables-shot.mjs [url]  ->  screenshots/perishables-shop.png
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const url = await devUrl(process.argv[2]);
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(url);
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(500);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
await page.evaluate(() => {
  const { store, rules } = window.__gg; const s = store.state;
  s.inventory.placed = []; s.inventory.cols = 6; s.inventory.rows = 5; // roomy cart: all eight items fit
  const put = (type, x, y, extra = {}) => s.inventory.placed.push({ uid: rules.newUid(s), type, x, y, rot: 0, tier: 1, ...extra });
  put('toaster', 0, 0); put('avocado', 2, 0, { age: 0 });          // fresh avocado
  put('pan', 0, 3); put('avocado', 2, 3, { age: 3 });               // brown avocado
  put('fish', 4, 0, { age: 1 }); put('fish', 4, 2, { age: 2 });     // fresh fish, stinking fish
  put('basil', 3, 4, { kills: 60 }); put('scoby', 5, 4, { age: 2 });
  s.money = 40;
  rules.recomputeBuild(s);
  store.changed();
});
await page.waitForTimeout(4500);
await page.click('text=Skip tutorial').catch(() => {});
await page.mouse.move(5, 5); await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/perishables-shop.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
