// Test Lab smoke test in the real page: loadout slots, item search, reset (two clicks), collapse, the roster that spawns with the fight,
// a Setup change in the middle of a fight (the fight restarts with the same dummies), and a real aisle with the bench collapsed and open.
// Pin and compare: pin the first fight, fight again, and the meter shows a "vs pin" change.
// Usage: [VIEW=1672x941] node tools/lab-flow-check.mjs   (starts its own dev server or uses $GG_URL; needs system Chrome, like tools/verify-shot.mjs)
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';

const [vw, vh] = (process.env.VIEW ?? '1280x800').split('x').map(Number);
const LAB = { aisle: 2, dept: 'frozen', shift: 0, starter: 'toaster', weapon: 'toaster', money: 999, cart: [5, 4], shelf: 6, shopLevel: 1, god: true, event: 'none', mod: 'none', sandbox: true };
const AVOID = ['#hud', '#punch', '#bossbar', '#simtag', '#simnote'];

const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: vw, height: vh } });
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

await page.goto(new URL('?lab=1', await devUrl()).href, { timeout: 120000 });
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
await page.click('[data-lb-tab="setup"]');
await page.selectOption('[data-lab="cart"]', '5x4');
await click('[data-lb-tab="items"]');
await click('[data-lb-save="1"]');
await click('[data-lb-tab="setup"]');
await page.selectOption('[data-lab="cart"]', '4x4');
await click('[data-lb-tab="items"]');
await click('[data-lb-load="1"]');
await click('[data-lb-tab="setup"]');
ok((await page.inputValue('[data-lab="cart"]')) === '5x4' && (await st(() => window.__gg.store.state.inventory.cols)) === 5, 'loading a slot puts its cart size into Setup as well');
await click('[data-lb-tab="items"]');

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
await page.waitForTimeout(2500);
const dealt = () => st(() => window.__gg.store.state.stats.removedByWeapon);
ok(Object.keys((await dealt()) ?? {}).length > 0, 'the meter counts the HP the dummies lost');
await click('[data-lb="pin-live"]');
ok((await page.textContent('[data-lb-meter]')).includes('Pinned'), 'Pin this shows the pinned average');
ok((await page.$('[data-lb-vspin]')) !== null, 'and a vs pin change right away');
await page.keyboard.press('F8');
await page.waitForTimeout(600);
ok((await st(() => window.__gg.store.state.phase)) === 'shop', 'F8 goes back to the cart editor');
await click('[data-lb-tab="items"]');
await click('[data-lb-add="fan"]');
await page.keyboard.press('F8');
await page.waitForTimeout(3500);
await click('[data-lb-tab="meter"]');
await page.waitForTimeout(500);
const vs = await page.textContent('[data-lb-vspin]').catch(() => null);
ok(vs !== null && /^[+-]?\d+%$/.test(vs.trim()), `after the second fight the meter shows a change against the pin (${vs})`);
ok(!(await page.isDisabled('[data-lb="pin-last"]')), 'the first fight is kept as last');
await click('[data-lb="unpin"]');
ok((await page.$('[data-lb-vspin]')) === null, 'Unpin removes the comparison');
await page.keyboard.press('F8');
await page.waitForTimeout(600);
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
