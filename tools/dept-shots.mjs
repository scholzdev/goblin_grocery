// DEV: screenshot each department mid-fight, the route screen, and the Tab view with hover stats.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => (m.type() === 'error' || m.text().includes('failed to load')) && errs.push(m.text()));
await page.goto(url);
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(500);
for (const d of ['frozen', 'bakery', 'electronics', 'checkout']) {
  await page.evaluate((d) => { const { store, flow } = window.__gg; const s = store.state; s.department = d; s.wave = 4; s.phase = 'combat'; s.hp = s.build.maxHp; flow.restartArena(); store.changed(); }, d);
  for (let i = 0; i < 6; i++) { await page.keyboard.down(i % 2 ? 'a' : 'd'); await page.waitForTimeout(700); await page.keyboard.up(i % 2 ? 'a' : 'd'); }
  await page.screenshot({ path: `screenshots/dept-${d}.png` });
}
await page.keyboard.press('Tab'); await page.waitForTimeout(200);
await page.hover('#loadout .item[data-uid] >> nth=0'); await page.waitForTimeout(150);
await page.screenshot({ path: 'screenshots/tab-hover.png' });
await page.keyboard.press('Tab');
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
await page.evaluate(() => { const s = window.__gg.store.state; s.shopLevel = 3; s.shop.shopIndex = 4; });
await page.click('[data-act="next"]'); await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/route.png' });
console.log('doors', await page.evaluate(() => window.__gg.store.state.doors));
await page.keyboard.press('1'); await page.waitForTimeout(1500);
console.log('after pick', await page.evaluate(() => { const s = window.__gg.store.state; return [s.phase, s.department, s.route.join('>')]; }));
console.log(errs.join('\n') || 'no errors');
await b.close();
