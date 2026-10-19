// DEV: the shop with four actives in the cart (3 slot badges + one "No slot"), inspector open on a slotted item. node tools/actives-shot.mjs [url]
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
  s.inventory.placed = [];
  const put = (type, x, y, rot = 0) => s.inventory.placed.push({ uid: rules.newUid(s), type, x, y, rot, tier: 1 });
  put('fireextinguisher', 4, 2); put('airhorn', 3, 0); put('vacuum', 0, 0); put('bubblewrap', 1, 1); put('toaster', 0, 3);
  rules.recomputeBuild(s);
  store.changed();
});
await page.waitForTimeout(300);
await (await page.$('.grid .item[data-uid] >> nth=1')).hover(); await page.waitForTimeout(300);
console.log('badges', await page.$$eval('.slot-badge', (e) => e.map((x) => x.textContent)));
await page.screenshot({ path: 'screenshots/actives-shop.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
