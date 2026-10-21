// Controller-only picks: a fake standard-mapping gamepad (no keyboard, no mouse) picks from the stockroom and the mini-boss crates,
// and an A still mashed as a dialog opens (A is also the shove) takes nothing.
// node tools/pad-pick-check.mjs [url]   (or GG_URL; starts its own dev server otherwise). Exits 1 when a step fails. Screenshots go to screenshots/.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';

const BTN = { A: 0, START: 9, RIGHT: 15 };
mkdirSync('screenshots', { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript(() => { // connected from the first frame, so src/input/gamepad.ts starts polling at boot
  const pad = { id: 'fake pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [pad] });
  // The game's own gamepad module: after a hot update the app loads it as `gamepad.ts?t=…`, and a plain import would be a second instance.
  window.__padModule = () => import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/input/gamepad.ts')) ?? '/src/input/gamepad.ts');
});

/** Down for a few frames, then up for a few: the pad loop acts on press edges. */
async function press(btn, ms = 120) {
  await page.evaluate((i) => { window.__pad.buttons[i].pressed = true; }, btn);
  await page.waitForTimeout(ms);
  await page.evaluate((i) => { window.__pad.buttons[i].pressed = false; }, btn);
  await page.waitForTimeout(ms);
}
let failed = 0;
function check(name, ok, got) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` (got ${JSON.stringify(got)})`}`);
  if (!ok) failed++;
}
const focused = () => page.evaluate(() => {
  const el = document.activeElement;
  return el?.closest('.stockroom') ? `card ${el.dataset.i}` : el?.closest('#pause') ? 'pause menu' : el?.tagName ?? null;
});
const offered = () => page.$$eval('.stockroom .card img.art', (imgs) => imgs.map((i) => /icon_(\w+)\.svg/.exec(i.getAttribute('src'))?.[1]));
const shelf = () => page.evaluate(() => window.__gg.store.state.inventory.shelf.map((it) => it?.type ?? null));
const closed = () => page.waitForSelector('.stockroom', { state: 'detached', timeout: 3000 }).then(() => true, () => false);
const goblin = () => page.evaluate(async () => ({ x: Math.round(window.__arena.player.x), y: Math.round(window.__arena.player.y), shoves: (await window.__padModule()).padShoves() }));
/** Arms a mash for the next pick dialog, in the page so no round trip delays it: A (also the shove) on the frame the dialog opens, then
 * the d-pad while the grace still runs. Resolves to the goblin as the dialog opened. */
async function mashIntoDialog(where, open) {
  await page.evaluate((btn) => {
    const pad = window.__pad;
    const hold = (i, at) => setTimeout(() => { pad.buttons[i].pressed = true; setTimeout(() => { pad.buttons[i].pressed = false; }, 80); }, at);
    const focus = () => { const el = document.activeElement; return el?.closest('.stockroom') ? `card ${el.dataset.i}` : el?.tagName; };
    window.__mash = null;
    window.__padModule().then((gp) => {
      const obs = new MutationObserver(() => {
        if (!document.querySelector('.stockroom .card')) return;
        obs.disconnect();
        const p = window.__arena.player, m = window.__mash = { goblin: { x: Math.round(p.x), y: Math.round(p.y), shoves: gp.padShoves() } };
        hold(btn.A, 0);
        setTimeout(() => { m.afterA = focus(); m.open = !!document.querySelector('.stockroom'); }, 170);
        hold(btn.RIGHT, 180);
        setTimeout(() => { m.afterRight = focus(); m.done = true; }, 350);
      });
      obs.observe(document.body, { childList: true, subtree: true });
      window.__mash = { armed: true };
    });
  }, BTN);
  await page.waitForFunction(() => window.__mash?.armed);
  await open();
  await page.waitForFunction(() => window.__mash?.done, null, { timeout: 15000 });
  const m = await page.evaluate(() => window.__mash);
  check(`${where}: an A mashed as the dialog opens takes nothing`, m.afterA === 'BODY' && m.open, m);
  check(`${where}: the d-pad works during that grace`, m.afterRight === 'card 0', m);
  return m.goblin;
}

await page.goto(await devUrl(process.argv[2]));
await page.waitForFunction(() => window.__gg && window.__arena, null, { timeout: 30000 });

// ── stockroom aisle: Start pauses over it, the d-pad walks the cards, A picks the second one ──
let before = await mashIntoDialog('stockroom', () => page.evaluate(async () => {
  const { flow, store } = window.__gg;
  flow.startRun('toaster', 0, 'toaster', 'main');
  await new Promise((r) => setTimeout(r, 500));
  store.state.modifier = 'stockroom';
  flow.restartArena();
}));
let items = await offered();
await press(BTN.RIGHT);
check('stockroom: right moves to card 2', (await focused()) === 'card 1', await focused());
await page.screenshot({ path: 'screenshots/pad-stockroom.png' });
await press(BTN.START);
await press(BTN.RIGHT);
check('stockroom: Start pauses and the d-pad drives the pause menu, not the cards', (await focused()) === 'pause menu', await focused());
await press(BTN.START);
await press(BTN.RIGHT);
await press(BTN.RIGHT);
check('stockroom: after resuming, the d-pad is back on the cards', (await focused()) === 'card 1', await focused());
let after = await goblin();
check('stockroom: the d-pad never moved the goblin and A never shoved', JSON.stringify(after) === JSON.stringify(before), { before, after });
await press(BTN.A);
check('stockroom: A picks and closes the dialog', await closed(), 'still open');
check(`stockroom: the second card (${items[1]}) is on the shelf`, (await shelf()).includes(items[1]), await shelf());
const ended = await page.waitForFunction(() => window.__gg.store.state.phase !== 'combat', null, { timeout: 8000 }).then(() => true, () => false);
check('stockroom: the aisle ends', ended, await page.evaluate(() => window.__gg.store.state.phase));

// ── mini-boss aisle: beat the mini-boss, then A picks the first crate ──
await page.evaluate(async () => {
  const { flow, store } = window.__gg;
  flow.startRun('toaster', 0, 'toaster', 'main');
  await new Promise((r) => setTimeout(r, 500));
  (await import('/src/ui/dev.ts')).jumpToMini();
  store.state.labGod = true;
});
await page.waitForFunction(() => window.__arena?.mini?.alive && window.__arena.mini.state !== 'spawn', null, { timeout: 30000 });
before = await mashIntoDialog('crates', () => page.evaluate(() => window.__arena.killEnemy(window.__arena.mini, true)));
items = await offered();
await page.screenshot({ path: 'screenshots/pad-crates.png' });
await page.waitForTimeout(400);
await press(BTN.A);
after = await goblin();
check('crates: A never shoved', after.shoves === before.shoves, { before, after });
check('crates: A picks and closes the dialog', await closed(), 'still open');
check(`crates: the first crate (${items[0]}) is on the shelf`, (await shelf()).includes(items[0]), await shelf());
const checkout = await page.waitForFunction(() => window.__gg.store.state.phase !== 'combat', null, { timeout: 8000 }).then(() => true, () => false);
check('crates: checkout begins', checkout, await page.evaluate(() => window.__gg.store.state.phase));

console.log(errs.join('\n') || 'no page errors');
await b.close();
process.exitCode = failed || errs.length ? 1 : 0;
