// DEV: exercise the shop with real pointer drags (buy, place+rotate, merge, invalid drop, sell).
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(await devUrl(process.argv[2]));
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(400);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 10000 });
await page.evaluate(() => { window.__gg.store.state.money = 200; window.__gg.store.changed(); });
const S = () => page.evaluate(() => { const s = window.__gg.store.state; return { money: s.money, placed: s.inventory.placed.map((i) => `${i.type}@${i.x},${i.y}r${i.rot}★${i.tier ?? 1}`).join(' '), shelf: s.inventory.shelf.map((i) => i?.type ?? '-').join(','), recipes: s.build.recipes.map((r) => r.id).join() }; });
const center = async (sel) => { const r = await (await page.$(sel)).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const cell = async (x, y) => center(`.cell[data-cx="${x}"][data-cy="${y}"]`);
async function drag(from, to, rotate = 0) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
  for (let i = 0; i < rotate; i++) await page.keyboard.press('r');
  await page.mouse.move(to.x, to.y, { steps: 8 }); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(120);
}
console.log('start', await S());
// Buy fan + fuel (shop 1 guarantees them) by clicking cards; double-click must not double-buy.
const fan = await page.$('.card[data-type="fan"]'); await fan.dblclick();
await (await page.$('.card[data-type="fuel"]')).click();
console.log('bought', await S());
// Toaster is at (1,1)-(2,1). Fan (1x2) → (0,0)/(0,1) vertical: drop grab cell at (0,1).
await drag(await center('.slot[data-slot="0"] .item'), await cell(0, 1));
// Fuel: rotate to horizontal then place at (1,0)-(2,0) above toaster.
await drag(await center('.slot[data-slot="1"] .item'), await cell(1, 0), 1);
console.log('placed', await S());
// Invalid drop: drag toaster onto pan's cells → must restore.
const before = await S();
await drag(await cell(1, 1), await cell(4, 1));
console.log('invalid drop restored:', JSON.stringify(before) === JSON.stringify(await S()));
// Buy another toaster via state (offers random) and merge by dragging onto existing toaster.
await page.evaluate(() => { const { store, rules } = window.__gg; const s = store.state; s.shop.offers[3] = { slot: 3, type: 'toaster', price: 12, sold: false, tier: 1 }; store.changed(); });
await (await page.$('.card[data-offer="3"]')).click();
await drag(await center('.slot .item'), await cell(1, 1));
console.log('merged', await S());
// Escape cancels a drag.
const b2 = await S();
await page.mouse.move(...Object.values(await cell(0, 0))); await page.mouse.down(); await page.mouse.move(700, 700, { steps: 5 });
await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(100);
console.log('esc cancel ok:', JSON.stringify(b2) === JSON.stringify(await S()), 'pause opened:', await page.isVisible('#pause'));
// L-shaped item: buy a Price Gun, place it from the shelf, then sell it from the grid.
await page.evaluate(() => { const { store } = window.__gg; const s = store.state; s.shop.offers[2] = { slot: 2, type: 'pricegun', price: 12, sold: false, tier: 1 }; store.changed(); });
await (await page.$('.card[data-offer="2"]')).click();
await drag(await center('.slot .item'), await cell(3, 2));
console.log('L placed', (await S()).placed.includes('pricegun'));
await drag(await center('.grid .item.shaped .anchor'), await center('.sell'));
console.log('L sold', !(await S()).placed.includes('pricegun'));
// Sell the pan via sell zone.
await drag(await cell(4, 0), await center('.sell'));
console.log('sold pan', await S());
await page.screenshot({ path: 'screenshots/drag-test.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
