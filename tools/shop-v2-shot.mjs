// DEV: starter screen + shop with services maxed, a combinable pair and the new item details panel.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(process.argv[2] ?? 'http://localhost:5173/');
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]'); await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/starter.png' });
await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]'); await page.waitForTimeout(500);
await page.keyboard.press('F2');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
await page.evaluate(() => { const { store } = window.__gg; const s = store.state; s.money = 300; s.shop.offers[3] = { slot: 3, type: 'toaster', price: 12, sold: false, tier: 1 }; store.changed(); });
for (const a of ['cart', 'cart', 'cart', 'shelf', 'shelf']) { await page.click(`[data-act="${a}"]`); await page.waitForTimeout(80); }
await (await page.$('.card[data-offer="3"]')).click();
await page.click('.grid .item[data-uid]'); await page.waitForTimeout(150);
await page.screenshot({ path: 'screenshots/shop-v2.png' });
const st = await page.evaluate(() => { const s = window.__gg.store.state; return { cols: s.inventory.cols, rows: s.inventory.rows, shelf: s.inventory.shelf.length, money: s.money }; });
await page.click('[data-act="combine"]'); await page.waitForTimeout(150);
const after = await page.evaluate(() => window.__gg.store.state.inventory.placed.map((i) => `${i.type}★${i.tier ?? 1}`));
await page.screenshot({ path: 'screenshots/shop-v2-combined.png' });
console.log(st, after, errs.join(';') || 'no errors');
await b.close();
