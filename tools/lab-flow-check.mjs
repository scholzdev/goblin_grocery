// Test Lab smoke test in the real page: loadout slots, item search, reset (two clicks), collapse, the roster that spawns with the fight,
// a Setup change in the middle of a fight (the fight restarts with the same dummies), and a real aisle with the bench collapsed and open.
// Usage: PORT=5182 node tools/lab-flow-check.mjs   (needs the dev server and system Chrome, like tools/verify-shot.mjs)
import { chromium } from 'playwright';

const PORT = process.env.PORT ?? 5173;
const LAB = { aisle: 2, dept: 'frozen', shift: 0, starter: 'toaster', weapon: 'toaster', money: 999, cart: [5, 4], shelf: 6, shopLevel: 1, god: true, event: 'none', mod: 'none', sandbox: true };
const AVOID = ['#hud', '#punch', '#bossbar', '#simtag', '#simnote'];

const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (cond, label) => { if (!cond) failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`); };
const st = (fn) => page.evaluate(fn);
const start = (o) => page.evaluate((x) => window.__gg.flow.startLab(x), o);
const click = (sel) => page.click(sel);
const dummies = () => st(() => window.__arena.enemies.filter((e) => e.alive && e.dummy).length);

async function benchClear(label) {
  const hits = await page.evaluate((avoid) => {
    const bench = document.querySelector('#labbench');
    if (!bench || bench.classList.contains('hidden')) return ['bench is not visible'];
    const r = bench.getBoundingClientRect(), out = [];
    for (const sel of avoid) {
      const el = document.querySelector(sel);
      if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') continue;
      const q = el.getBoundingClientRect();
      if (q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) out.push(sel);
    }
    return out;
  }, AVOID);
  ok(hits.length === 0, `${label}${hits.length ? ': overlaps ' + hits.join(', ') : ''}`);
}

await page.goto(`http://localhost:${PORT}/?lab=1`, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.clear());
await start(LAB);
await page.waitForTimeout(500);

for (const id of ['toaster', 'fan', 'battery']) await click(`[data-lb-add="${id}"]`);
const count = () => st(() => window.__gg.store.state.inventory.placed.length);
ok((await count()) === 3, 'three items land in the cart');
await click('[data-lb-save="0"]');
await click('[data-lb="clear"]');
ok((await count()) === 0, 'clear all empties the cart');
await click('[data-lb-load="0"]');
ok((await count()) === 3, 'loading the slot brings the cart back');

const before = await st(() => ({ phase: window.__gg.store.state.phase, money: window.__gg.store.state.money, offers: window.__gg.store.state.shop.offers.map((o) => o.type).join() }));
const total = await page.$$eval('[data-lb-add]', (e) => e.length);
await page.fill('.lb-search', 'fan');
const visible = await page.$$eval('[data-lb-add]:not([hidden])', (e) => e.length);
await page.keyboard.press('r'); // the rotate key: the search field takes it
const after = await st(() => ({ phase: window.__gg.store.state.phase, money: window.__gg.store.state.money, offers: window.__gg.store.state.shop.offers.map((o) => o.type).join() }));
ok(visible > 0 && visible < total, `search narrows the palette (${visible} of ${total})`);
ok(JSON.stringify(before) === JSON.stringify(after), 'typing in the search changes nothing in the game');
await page.fill('.lb-search', '');

await click('[data-lb="reset"]');
ok((await count()) === 3 && /Really/i.test(await page.textContent('[data-lb="reset"]')), 'the first Reset click only asks');
await click('[data-lb="reset"]');
await page.waitForTimeout(400);
ok((await count()) === 0, 'the second Reset click starts clean');

await click('[data-lb-add="toaster"]');
await click('[data-lb-tab="foes"]');
await click('[data-lb-count="3"]');
await click('[data-lb-foe="milk"]');
await page.keyboard.press('F8');
await page.waitForTimeout(2500);
const n0 = await dummies();
ok(n0 === 3, `the roster from the cart editor spawns (${n0})`);
await click('[data-lb-tab="setup"]');
await page.selectOption('[data-lab="dept"]', 'bakery');
await page.waitForTimeout(2500);
const mid = await st(() => ({ phase: window.__gg.store.state.phase, dept: window.__gg.store.state.department }));
ok(mid.phase === 'combat' && mid.dept === 'bakery', `a Setup change restarts the fight (${mid.phase}, ${mid.dept})`);
ok((await dummies()) === n0, 'the same dummies come back');
await benchClear('arena, setup tab, clear of the HUD');

await click('[data-lb="collapse"]');
ok(await st(() => document.querySelector('#labbench').classList.contains('collapsed')), 'the bench collapses to a pill');
await click('[data-lb="collapse"]');
ok(!(await st(() => document.querySelector('#labbench').classList.contains('collapsed'))), 'and opens again');

await click('[data-lb-tab="meter"]');
await page.keyboard.press('F8');
await page.waitForTimeout(600);
ok((await st(() => window.__gg.store.state.phase)) === 'shop', 'F8 goes back to the cart editor');
await click('[data-lb-tab="meter"]');
await benchClear('cart editor, meter tab');

for (const aisle of [2, 8]) {
  await start({ ...LAB, aisle, sandbox: false });
  await page.waitForTimeout(500);
  await click('[data-lb-add="toaster"]');
  await click('#shop [data-act="next"]');
  await page.waitForTimeout(2500);
  const phase = await st(() => window.__gg.store.state.phase);
  ok(phase === 'combat' && !(await st(() => window.__gg.store.state.labSandbox)), `real aisle ${aisle} is running`);
  await benchClear(`real aisle ${aisle}, bench collapsed`);
  await click('[data-lb="collapse"]');
  await benchClear(`real aisle ${aisle}, bench open`);
}

ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
await b.close();
console.log(failed ? `${failed} problem(s)` : 'lab flow ok');
process.exit(failed ? 1 : 0);
