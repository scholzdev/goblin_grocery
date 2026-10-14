// DEV: build a rich shop state (tiers, legendaries, L-shapes) and capture the shop at two sizes.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const b = await chromium.launch({ channel: 'chrome' });
for (const [W, H] of [[1440, 900], [1280, 720]]) {
  const page = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(url);
  await page.waitForSelector('#title:not(.hidden)');
  await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.waitForTimeout(500);
  await page.keyboard.press('F2');
  await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
  await page.evaluate(() => {
    const { store, rules } = window.__gg; const s = store.state;
    s.inventory.placed = [];
    const put = (type, x, y, rot = 0, tier = 1) => s.inventory.placed.push({ uid: rules.newUid(s), type, x, y, rot, tier });
    put('fan', 0, 0, 0, 2); put('toaster', 1, 0, 0, 3); put('fuel', 3, 0); put('goldstar', 4, 0);
    put('pricegun', 3, 2, 0, 2); put('laser', 1, 1); put('bell', 4, 1);
    rules.recomputeBuild(s);
    const mop = { uid: rules.newUid(s), type: 'mop', x: 0, y: 0, rot: 0 }; s.inventory.shelf[1] = mop;
    for (const rot of [0, 1, 2, 3]) if (rules.moveItem(s, mop.uid, { where: 'grid', x: 0, y: 2, rot }).ok) break;
    
    s.inventory.shelf[0] = { uid: rules.newUid(s), type: 'snackbag', x: 0, y: 0, rot: 0, tier: 1 };
    rules.recomputeBuild(s);
    for (const it of s.inventory.placed) if (!rules.previewMove(s, it.uid, { where: 'grid', x: it.x, y: it.y, rot: it.rot }).result.ok) console.error('bad test layout', it.type);
    s.money = 120; s.wave = 3; s.shop.shopIndex = 3; s.shopLevel = 3;
    s.shop.offers = [
      { slot: 0, type: 'powerstrip', price: 32, sold: false, tier: 1 },
      { slot: 1, type: 'microwave', price: 40, sold: false, tier: 2 },
      { slot: 2, type: 'blender', price: 60, sold: false, tier: 3 },
      { slot: 3, type: 'coupon', price: 8, sold: false, tier: 1 },
    ];
    store.changed();
  });
  await page.waitForTimeout(300);
  const t = await page.$('.grid .item[data-uid] >> nth=1');
  await t.hover(); await page.waitForTimeout(200);
  await page.screenshot({ path: `screenshots/shop-rich-${W}x${H}.png` });
  console.log(W, H, errs.join('\n') || 'no errors');
  await page.close();
}
await b.close();
