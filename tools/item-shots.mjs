// DEV: capture the in-game item card of every item (Catalog > Items, hover) and lay them out as contact sheets of 12.
// Usage: node tools/item-shots.mjs [url]  ->  screenshots/items/<id>.png + screenshots/items-sheet-<n>.png
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
import { mkdirSync } from 'node:fs';
const url = await devUrl(process.argv[2]);
const PER_SHEET = 12;
mkdirSync('screenshots/items', { recursive: true });
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(url);
await page.waitForSelector('#title:not(.hidden)');
const tap = (sel) => page.$eval(sel, (el) => el.click());
if (await page.$('[data-act="unlock-all"]')) await tap('[data-act="unlock-all"]');
await tap('[data-act="codex"]');
await page.waitForSelector('[data-act="codex-tab"][data-tab="items"]');
await tap('[data-act="codex-tab"][data-tab="items"]');
await page.waitForSelector('.codex-item[data-card]');
const ids = await page.$$eval('.codex-item[data-card]', (els) => els.map((e) => e.dataset.card));
const shots = [];
for (const id of ids) {
  await page.mouse.move(0, 0);
  await page.hover(`.codex-item[data-card="${id}"]`);
  const card = await page.waitForSelector('.inspector.itemcard', { state: 'visible' });
  await page.waitForTimeout(120);
  const png = await card.screenshot({ path: `screenshots/items/${id}.png` });
  shots.push({ id, src: `data:image/png;base64,${png.toString('base64')}` });
}
const sheet = await b.newPage({ viewport: { width: 1600, height: 900 } });
for (let i = 0; i < shots.length; i += PER_SHEET) {
  const cells = shots.slice(i, i + PER_SHEET).map((s) => `<figure><img src="${s.src}"><figcaption>${s.id}</figcaption></figure>`).join('');
  await sheet.setContent(`<style>body{margin:0;padding:16px;background:#1d1a24;font:12px sans-serif;color:#ccc}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start}figure{margin:0}img{max-width:100%}</style><main>${cells}</main>`);
  await sheet.waitForTimeout(100);
  await sheet.screenshot({ path: `screenshots/items-sheet-${i / PER_SHEET + 1}.png`, fullPage: true });
}
console.log(`${shots.length} items`, errs.join('\n') || 'no errors');
await b.close();
