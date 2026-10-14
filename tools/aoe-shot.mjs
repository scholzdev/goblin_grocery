// DEV: build an AOE/multi-hit cart (Pressure Point, Mist Machine, Popper, Double Bag, Multipack) and capture combat.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => (m.type() === 'error') && errs.push(m.text()));
await page.goto(process.argv[2] ?? 'http://localhost:5173/');
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.waitForTimeout(400);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
const res = await page.evaluate(() => {
  const { store, rules, flow } = window.__gg; const s = store.state; const out = [];
  s.inventory.placed = [];
  const add = (type, x, y, rot = 0) => { const it = { uid: rules.newUid(s), type, x: 0, y: 0, rot: 0 }; s.inventory.shelf[0] = it; out.push(type + ':' + rules.moveItem(s, it.uid, { where: 'grid', x, y, rot }).ok); };
  add('cooker', 0, 0); add('fuel', 2, 0); add('spray', 3, 0); add('fan', 4, 0);
  add('popper', 0, 2); add('pan', 1, 2, 1); add('doublebag', 1, 3); add('multipack', 3, 3);
  s.inventory.shelf = [null, null, null, null];
  rules.recomputeBuild(s);
  s.hp = s.build.maxHp; s.wave = 5; s.phase = 'combat'; s.department = 'main';
  flow.restartArena(); store.changed();
  return { out, recipes: s.build.recipes.map((r) => r.id), weapons: s.build.weapons.map((w) => `${w.type} c${w.count} echo${w.echo} pop${!!w.popper} arc${w.arcDeg}`) };
});
console.log(res);
for (let i = 0; i < 10; i++) { await page.keyboard.down(i % 2 ? 'a' : 'd'); await page.waitForTimeout(600); await page.keyboard.up(i % 2 ? 'a' : 'd'); if (i === 7) await page.screenshot({ path: 'screenshots/aoe-combat.png' }); }
console.log(await page.evaluate(() => window.__gg.store.state.stats.damageByWeapon), errs.join('\n') || 'no errors');
await b.close();
