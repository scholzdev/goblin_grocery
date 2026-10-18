// DEV: meta-progression screens (Codex combos/items, Wardrobe), discovery pop-up, skinned goblin in combat.
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(await devUrl(process.argv[2]));
await page.evaluate(() => localStorage.setItem('goblin-grocery.profile.v1', JSON.stringify({
  v: 1, stats: { runs: 5, wins: 1, losses: 4, kills: 420, coins: 380, bestWave: 8, combos: 3, deptClears: { frozen: 2, bakery: 1 } },
  recipes: ['toastMode', 'expressCheckout', 'coldStorage'],
  unlocked: ['microwave', 'spray', 'fizz', 'mop', 'blender', 'tape', 'bubblewrap', 'popper', 'multipack', 'powerstrip', 'snackbag', 'skin-night', 'cart-gold'],
  goblin: 'night', cart: 'gold',
})));
await page.reload();
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="codex"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/codex-combos.png' });
await page.click('[data-tab="items"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/codex-items.png' });
await page.click('[data-act="close-settings"]');
await page.click('[data-act="wardrobe"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/wardrobe.png' });
await page.click('[data-act="close-settings"]');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/skin-combat.png' });
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
// Discover Nailstorm through the rules (fresh discovery → pop-up).
await page.evaluate(() => {
  const { store, rules } = window.__gg; const s = store.state;
  const add = (type, x, y) => { const it = { uid: rules.newUid(s), type, x: 0, y: 0, rot: 0 }; s.inventory.shelf[0] = it; rules.moveItem(s, it.uid, { where: 'grid', x, y, rot: 0 }); };
  add('nailgun', 1, 2); add('magnet', 0, 2); add('battery', 3, 2); store.changed();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/discovery.png' });
console.log('recipes now', await page.evaluate(() => JSON.parse(localStorage.getItem('goblin-grocery.profile.v1')).recipes), errs.join(';') || 'no errors');
await b.close();
