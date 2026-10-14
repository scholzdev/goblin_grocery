// DEV: Pan with Express Checkout + Sizzling Skillet active at once; capture shop + details panel.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(process.argv[2] ?? 'http://localhost:5173/');
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="pan"]'); await page.waitForTimeout(400);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
const info = await page.evaluate(() => {
  const { store, rules } = window.__gg; const s = store.state;
  const add = (type, x, y, rot = 0) => { const it = { uid: rules.newUid(s), type, x: 0, y: 0, rot: 0 }; s.inventory.shelf[0] = it; return rules.moveItem(s, it.uid, { where: 'grid', x, y, rot }).ok; };
  const r = [add('bell', 1, 0), add('fuel', 3, 0), add('hotsauce', 1, 1)];
  store.changed();
  return { r, recipes: s.build.weapons[0].recipes };
});
await page.click('.grid .item.weapon'); await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/double-combo.png' });
console.log(info, errs.join(';') || 'no errors');
await b.close();
