// DEV bot: plays a whole run (circle-strafing + random shoves), auto-shops, reports per-wave stats.
// Usage: node tools/fullrun.mjs [url] [shopping=1]
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const shopping = process.argv[3] !== '0';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]');
const st = () => page.evaluate(() => { const s = window.__gg.store.state; return { phase: s.phase, wave: s.wave, hp: Math.round(s.hp), money: s.money, kills: s.stats.kills, recipes: s.build.recipes.map((r) => r.id) }; });
const dirs = [['d'], ['d', 's'], ['s'], ['s', 'a'], ['a'], ['a', 'w'], ['w'], ['w', 'd']];
let i = 0;
const t0 = Date.now();
while (Date.now() - t0 < 14 * 60_000) {
  const s = await st();
  if (s.phase === 'victory' || s.phase === 'defeat') { console.log('END', s); break; }
  if (s.phase === 'route') { await page.click('[data-act="door"]'); continue; }
  if (s.phase === 'shop') {
    console.log('SHOP after wave', s.wave, s);
    if (shopping) await page.evaluate(() => {
      const { store, rules } = window.__gg; const s = store.state;
      for (const o of s.shop.offers) rules.buyOffer(s, o.slot);
      for (let k = 0; k < 4; k++) {
        const it = s.inventory.shelf[k]; if (!it) continue;
        outer: for (const rot of [0, 1]) for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) if (rules.moveItem(s, it.uid, { where: 'grid', x, y, rot }).ok) break outer;
      }
      if (s.hp < s.build.maxHp - 8) rules.repair(s);
      store.changed();
    });
    await page.click('[data-act="next"]');
    continue;
  }
  if (s.phase === 'combat') {
    const d = dirs[i++ % dirs.length];
    for (const k of d) await page.keyboard.down(k);
    await page.waitForTimeout(450);
    if (i % 7 === 0) await page.keyboard.press('Space');
    for (const k of d) await page.keyboard.up(k);
  } else await page.waitForTimeout(300);
}
console.log('elapsed s', Math.round((Date.now() - t0) / 1000));
await page.screenshot({ path: 'screenshots/fullrun-end.png' });
console.log(errors.join('\n') || 'no errors');
await browser.close();
