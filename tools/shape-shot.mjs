// DEV: reproduce the L-shape layout (Price Gun around a Desk Fan) and capture it, incl. selected state.
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(await devUrl(process.argv[2]));
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(400);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
const ok = await page.evaluate(() => {
  const { store, rules } = window.__gg; const s = store.state; const res = [];
  const add = (type, x, y, rot, tier = 1) => { const it = { uid: rules.newUid(s), type, x: 0, y: 0, rot: 0, tier }; s.inventory.shelf[0] = it; res.push(type + ':' + rules.moveItem(s, it.uid, { where: 'grid', x, y, rot }).ok); };
  s.inventory.placed = s.inventory.placed.filter((i) => i.type === 'pan');
  // Price Gun base shape (0,0),(1,0),(0,1) at (0,1) leaves (1,2) empty; the fan goes exactly there.
  add('pricegun', 0, 1, 0); add('fan', 1, 2, 0, 2); add('coupon', 2, 2, 0); add('mop', 2, 0, 1); add('toaster', 2, 3, 0);
  rules.recomputeBuild(s); store.changed(); return res;
});
console.log(ok);
await page.click('.grid .item.shaped .anchor >> nth=0'); await page.waitForTimeout(150);
const g = await (await page.$('.grid-wrap')).boundingBox();
await page.screenshot({ path: 'screenshots/shape-fix.png', clip: g });
// The fan must be clickable through the L's empty corner.
const fan = await page.$('.grid .item.module.r2[data-uid]:not(.shaped)');
const fb = await fan.boundingBox();
const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.item')?.querySelector('.tag')?.textContent, [fb.x + fb.width * 0.25, fb.y + fb.height * 0.5]);
console.log('element under fan:', top, errs.join(';') || 'no errors');
await b.close();
