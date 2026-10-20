// DEV: fresh profile; mid-drag screenshot where a drop would trigger an undiscovered combo (mystery card).
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(await devUrl(process.argv[2]));
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(400);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
await page.evaluate(() => { window.__gg.store.state.money = 100; window.__gg.store.changed(); });
await page.waitForTimeout(150);
await page.screenshot({ path: 'screenshots/combos-empty.png', clip: { x: 390, y: 540, width: 580, height: 260 } });
const center = async (sel) => { const r = await (await page.$(sel)).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
await page.evaluate(() => { const { store } = window.__gg; const o = store.state.shop.offers; o[0] = { slot: 0, type: 'fan', price: 9, sold: false, tier: 1 }; o[1] = { slot: 1, type: 'fuel', price: 11, sold: false, tier: 1 }; store.changed(); }); // shop 1's openers vary per run
await (await page.$('.card[data-type="fan"]')).click();
await (await page.$('.card[data-type="fuel"]')).click();
const drag = async (from, to, hold) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 }); await page.waitForTimeout(120); if (!hold) await page.mouse.up(); };
await drag(await center('.slot[data-slot="0"] .item'), await center('.cell[data-cx="0"][data-cy="1"]'));
await page.waitForTimeout(150);
await drag(await center('.slot[data-slot="1"] .item'), await center('.cell[data-cx="3"][data-cy="1"]'), true);
await page.screenshot({ path: 'screenshots/combos-mystery.png', clip: { x: 390, y: 90, width: 580, height: 720 } });
await page.mouse.up(); await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/combos-discovered.png', clip: { x: 390, y: 90, width: 580, height: 720 } });
console.log(await page.evaluate(() => window.__gg.store.state.build.recipes.map((r) => r.id)), errs.join(';') || 'no errors');
await b.close();
