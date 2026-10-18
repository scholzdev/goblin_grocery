// DEV: set up a single combo cart (default: TV Dinner) and capture a burst of combat frames + Tab view.
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(await devUrl(process.argv[2]));
await page.waitForSelector('#title:not(.hidden)');
await page.evaluate(() => { localStorage.setItem('goblin-grocery.settings.v1', JSON.stringify({ hintSeen: true })); });
await page.reload(); await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(400);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
const info = await page.evaluate(() => {
  const { store, rules, flow } = window.__gg; const s = store.state; const out = [];
  s.inventory.placed = [];
  const add = (type, x, y, rot = 0) => { const it = { uid: rules.newUid(s), type, x: 0, y: 0, rot: 0 }; s.inventory.shelf[0] = it; out.push(type + ':' + rules.moveItem(s, it.uid, { where: 'grid', x, y, rot }).ok); };
  add('microwave', 1, 1); add('lunchbox', 1, 0); add('battery', 3, 1);
  s.inventory.shelf = [null, null, null, null];
  rules.recomputeBuild(s);
  s.hp = s.build.maxHp; s.wave = 6; s.phase = 'combat'; s.department = 'electronics';
  flow.restartArena(); store.changed();
  const w = s.build.weapons[0];
  return { out, recipes: s.build.recipes.map((r) => r.id), w: { dmg: w.damage, cd: w.cooldown, chain: w.chain, aoe: w.aoe } };
});
console.log(info);
// Let enemies arrive, grab the Tab view, then frames right after each zap fires.
await page.waitForTimeout(6000);
await page.keyboard.press('Tab'); await page.waitForTimeout(200);
await page.hover('#loadout .item.weapon >> nth=0'); await page.waitForTimeout(150);
await page.screenshot({ path: 'screenshots/combo-tab.png' });
await page.keyboard.press('Tab'); await page.waitForTimeout(200);
let shots = 0;
for (let i = 0; i < 160 && shots < 2; i++) {
  const zapping = await page.evaluate(() => window.__arena.children.list.some((o) => o.texture?.key === 'fx_zap' && o.alpha > 0.7));
  if (zapping) { await page.screenshot({ path: `screenshots/combo-${shots++}.png` }); await page.waitForTimeout(900); }
  else await page.waitForTimeout(40);
  if (i % 10 === 0) { await page.keyboard.down(i % 20 ? 'a' : 'd'); await page.waitForTimeout(250); await page.keyboard.up(i % 20 ? 'a' : 'd'); }
}
console.log('frames', shots, errs.join(';') || 'no errors');
await b.close();
