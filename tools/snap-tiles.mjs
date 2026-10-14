// Tiling proof: 4x3 grids of the seamless floors / conveyor (and horizontal-only cable). Usage: node tools/snap-tiles.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = (k) => `file://${root}/public/assets/svg/${k}.svg`;
const grid = (k, w, h, cols = 4, rows = 3) => `<div style="margin:6px;display:grid;grid-template-columns:repeat(${cols},${w}px);line-height:0;background:url(${svg(k)}) 0 0/${w}px ${h}px"><div style="grid-column:1/-1;height:${h * rows}px;background:url(${svg(k)}) 0 0/${w}px ${h}px"></div></div>`;
const html = `<body style="margin:6px;background:#222;display:flex;flex-wrap:wrap;width:2200px">` +
  ['floor_frozen', 'floor_bakery', 'floor_electronics', 'floor_checkout'].map((k) => grid(k, 128, 128)).join('') +
  grid('hz_conveyor', 128, 64) + grid('hz_cable', 256, 36, 4, 1) + `</body>`;
fs.mkdirSync(`${root}/screenshots`, { recursive: true });
fs.writeFileSync(`${root}/screenshots/_tiles.html`, html);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 2220, height: 800 } });
await p.goto(`file://${root}/screenshots/_tiles.html`);
await p.waitForTimeout(400);
await p.screenshot({ path: `${root}/screenshots/tiling.png`, fullPage: true });
await b.close();
fs.rmSync(`${root}/screenshots/_tiles.html`);
