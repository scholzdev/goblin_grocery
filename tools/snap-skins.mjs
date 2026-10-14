// Skin sheet: assembled goblin + cart per skin pair at ~0.8x. Usage: node tools/snap-skins.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const Z = +(process.argv[2] ?? 0.8), OUT = process.argv[3] ?? 'skins';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const im = (k, x, y) => `<img src="file://${root}/public/assets/svg/${k}.svg" style="left:${x}px;top:${y}px">`;
const sfx = (s) => (s ? `__${s}` : '');
const rig = (g, c, ox) => `<div class="r" style="left:${ox}px">` + im('shadow', 20, 215) + im(`goblin_legs_a${sfx(g)}`, 58, 199) + im(`goblin_torso${sfx(g)}`, 62, 150) + im(`goblin_head${sfx(g)}`, 42, 100) +
  im(`cart_back${sfx(c)}`, 120, 170) + im(`cart_front${sfx(c)}`, 120, 170) + im(`cart_wheel${sfx(c)}`, 150, 240) + im(`cart_wheel${sfx(c)}`, 212, 240) + im(`goblin_arm${sfx(g)}`, 98, 178) +
  im(`goblin_head_hurt${sfx(g)}`, 10, 270).replace('style="', 'style="zoom:.7;') + im(`goblin_head_shove${sfx(g)}`, 100, 270).replace('style="', 'style="zoom:.7;') + `</div>`;
const html = `<body style="margin:0;background:#B8DED2"><style>.r{position:absolute;top:0;width:330px;height:340px;zoom:${Z}}img{position:absolute}</style><div style="position:relative;width:${Math.round(1100*Z/0.8)}px;height:${Math.round(290*Z/0.8)}px">` +
  [[null, null], ['night', 'coral'], ['frost', 'gold'], ['gold', null]].map(([g, c], i) => rig(g, c, i * 270)).join('') + `</div></body>`;
fs.mkdirSync(`${root}/screenshots`, { recursive: true });
fs.writeFileSync(`${root}/screenshots/_skins.html`, html);
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: Math.round(1100 * Z / 0.8), height: Math.round(300 * Z / 0.8) } });
await p.goto(`file://${root}/screenshots/_skins.html`);
await p.waitForTimeout(300);
await p.screenshot({ path: `${root}/screenshots/${OUT}.png` });
await b.close();
fs.rmSync(`${root}/screenshots/_skins.html`);
