// Goblin Grocery - procedural vector art. Run: node tools/gen-assets.mjs
// Writes public/assets/svg/<key>.svg for every key in SVG_ASSETS (src/data/assets.ts) + contact-sheet.html.
// Style: angular cut-paper shapes, flat fills + ONE shade tone per material (lower-right crescent via clip),
// plum edge (SW=3 at listed size, 5 on 192px icons, 2 on tiny details), light from upper-left.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/assets/svg');

// ---------- manifest (duplicated from src/data/assets.ts; keep in sync) ----------
// Parsed from src/data/assets.ts so the key/size list cannot drift.
const TS = fs.readFileSync(path.join(ROOT, 'src/data/assets.ts'), 'utf8');
const ICON_IDS = [...TS.match(/ICON_IDS = \[([\s\S]*?)\] as const/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
const M = (key, w, h) => ({ key, w, h });
const MANIFEST = [
  ...[...TS.matchAll(/\{ key: '(\w+)', w: (\d+), h: (\d+)/g)].map((m) => M(m[1], +m[2], +m[3])),
  ...ICON_IDS.map((id) => M(`icon_${id}`, 192, 192)),
];

// ---------- palette ----------
const C = {
  plum: '#30203F', plumSoft: '#4A3560', lav: '#9081B6', lavD: '#6E5F98', lavL: '#B9AED6',
  mint: '#B8DED2', mintD: '#94C9B9', mintL: '#D5EBDD', cream: '#FFF2D5', creamD: '#F2DDB4',
  coral: '#F45F52', coralD: '#C9443B', coralL: '#F9A08F', green: '#8FCB57', greenD: '#5E9A35', greenL: '#B7E27F',
  gold: '#F5BD45', goldD: '#D08D20', teal: '#3FB7A6', tealD: '#2A8C7E', sky: '#7CC4E8', white: '#FFFDF7',
  blue: '#4E7FC9', blueD: '#34599A', det: '#3E6FD0', detD: '#2D52A3',
  banana: '#F6D24A', bananaD: '#D9A92B', bananaL: '#FFF0A0',
  bread: '#D9954A', breadD: '#B86F2D', breadL: '#EDB870',
  soda: '#E2473F', sodaD: '#B1302D', chrome: '#D9DDE6', chromeD: '#9AA3B5', chromeL: '#F2F4F8',
  frost: '#CFF3FF', frostD: '#8CCDE6',
  pink: '#FF8FC0', pinkD: '#D45A92', pinkL: '#FFC2DD',
};
const SW = 3, SWs = 2, SWi = 5;

// ---------- helpers ----------
let uid = 0;
const n = (v) => +v.toFixed(1);
const P = (a) => a.map((p) => `${n(p[0])},${n(p[1])}`).join(' ');
const D = (a, close = true) => 'M' + a.map((p) => `${n(p[0])} ${n(p[1])}`).join('L') + (close ? 'Z' : '');
const doc = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const jit = (pts, a = 1, seed = 1) => { const r = rng(seed * 977 + 13); return pts.map(([x, y]) => [x + (r() - 0.5) * 2 * a, y + (r() - 0.5) * 2 * a]); };
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const rot = (inner, deg, cx, cy) => `<g transform="rotate(${deg} ${cx} ${cy})">${inner}</g>`;
const squash = (cx, gy, sx, sy, inner) => `<g transform="translate(${cx} ${gy}) scale(${sx} ${sy}) translate(${-cx} ${-gy})">${inner}</g>`;

// outlined flat shape with a single shadow tone on the lower-right (shade offset by dx,dy)
function shape(g, fill, shade, o = {}) {
  const dd = typeof g === 'string' ? g : D(g);
  const sw = o.sw ?? SW, st = o.stroke ?? C.plum, ex = o.attrs ?? '';
  const line = `<path d="${dd}" fill="${shade ? 'none' : fill}" stroke="${st}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  if (!shade) return ex ? `<g ${ex}>${line}</g>` : line;
  const id = `c${++uid}`, sx = o.dx ?? 3, sy = o.dy ?? 3;
  return `<g ${ex}><clipPath id="${id}"><path d="${dd}"/></clipPath><path d="${dd}" fill="${shade}"/>` +
    `<g clip-path="url(#${id})"><path transform="translate(${-sx} ${-sy})" d="${dd}" fill="${fill}"/></g>${line}</g>`;
}
const flat = (g, fill, extra = '') => `<path d="${typeof g === 'string' ? g : D(g)}" fill="${fill}" ${extra}/>`; // no outline (highlights/cuts)
const ell = (cx, cy, rx, ry, fill, shade, o = {}) => shape(ellPath(cx, cy, rx, ry), fill, shade, o);
const ellPath = (cx, cy, rx, ry) => `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;
const line = (pts, col, w, extra = '') => `<path d="${D(pts, false)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
// outlined thick tube (limbs, hoses, handles): plum under-stroke + fill stroke
const tube = (pts, w, fill, ol = SW) => line(pts, C.plum, w + ol * 2) + line(pts, fill, w);
const stick = (pts, w = 3.5, foot = 0) => {
  let s = line(pts, C.plum, w);
  if (foot) { const [x, y] = pts[pts.length - 1]; s += line([[x - 3, y], [x + foot, y]], C.plum, w); }
  return s;
};
const shadowE = (cx, cy, rx, ry, o = 0.25) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.lav}" opacity="${o}"/>` +
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.72}" ry="${ry * 0.7}" fill="${C.lav}" opacity="${o}"/>`;
const star = (cx, cy, ro, ri, k, rot0 = -90) => {
  const a = [];
  for (let i = 0; i < k * 2; i++) { const r = i % 2 ? ri : ro, t = ((rot0 + (i * 180) / k) * Math.PI) / 180; a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  return a;
};
const snowflake = (cx, cy, r, col, w) => {
  let s = '';
  for (let i = 0; i < 3; i++) {
    const t = (i * Math.PI) / 3 + Math.PI / 6;
    s += line([[cx - Math.cos(t) * r, cy - Math.sin(t) * r], [cx + Math.cos(t) * r, cy + Math.sin(t) * r]], col, w);
    for (const sg of [-1, 1]) {
      const bx = Math.cos(t) * sg, by = Math.sin(t) * sg, ex = cx + bx * r * 0.62, ey = cy + by * r * 0.62;
      for (const a of [-0.8, 0.8]) s += line([[ex, ey], [ex + (bx * Math.cos(a) - by * Math.sin(a)) * r * 0.34, ey + (bx * Math.sin(a) + by * Math.cos(a)) * r * 0.34]], col, w);
    }
  }
  return s;
};
// 3/4 box: front face, top face (up-right), side face (right)
function prism(x, y, w, h, dx, dy, fr, top, side, o = {}) {
  const sw = o.sw ?? SW;
  return shape([[x + w, y], [x + w + dx, y - dy], [x + w + dx, y + h - dy], [x + w, y + h]], side[0], side[1], { sw, dx: 2, dy: 2 }) +
    shape([[x, y], [x + dx, y - dy], [x + w + dx, y - dy], [x + w, y]], top[0], top[1], { sw, dx: 3, dy: 2 }) +
    shape(rect(x, y, w, h), fr[0], fr[1], { sw, dx: o.sdx ?? 4, dy: o.sdy ?? 4 });
}
const can = (cx, top, w, h, body, shade, band, o = {}) => {
  const l = cx - w / 2, r = cx + w / 2, b = top + h, ry = w * 0.2, id = `c${++uid}`;
  const bd = `M${n(l)} ${n(top)}L${n(l)} ${n(b)}A${n(w / 2)} ${n(ry)} 0 0 0 ${n(r)} ${n(b)}L${n(r)} ${n(top)}Z`;
  let s = shape(bd, body, shade, { sw: o.sw ?? SWs, dx: 3, dy: 0 });
  if (band) {
    const y1 = top + h * 0.38, y2 = top + h * 0.7;
    s += `<clipPath id="${id}"><path d="${bd}"/></clipPath><g clip-path="url(#${id})"><path d="M${n(l)} ${n(y1)}A${n(w / 2)} ${n(ry)} 0 0 0 ${n(r)} ${n(y1)}L${n(r)} ${n(y2)}A${n(w / 2)} ${n(ry)} 0 0 0 ${n(l)} ${n(y2)}Z" fill="${band}"/></g>`;
    s += `<path d="${bd}" fill="none" stroke="${C.plum}" stroke-width="${o.sw ?? SWs}" stroke-linejoin="round"/>`;
  }
  return s + shape(ellPath(cx, top, w / 2, ry), C.chrome, C.chromeD, { sw: o.sw ?? SWs, dx: 2, dy: 1 }) +
    `<ellipse cx="${n(cx)}" cy="${n(top)}" rx="${n(w * 0.26)}" ry="${n(ry * 0.5)}" fill="none" stroke="${C.chromeD}" stroke-width="1.2"/>`;
};

const brow = (x1, y1, x2, y2, w = 3.5) => line([[x1, y1], [x2, y2]], C.plum, w).replace('round"', 'butt"');
// ---------- food-limbed parts (noodle limbs in the body's own colour, mitten hands, nub feet) ----------
// stroke an SVG path string (line() takes points)
const strokeD = (d, col, w) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// noodle limb: plum outline with a body-coloured core
const limb = (d, col, w = 6) => strokeD(d, C.plum, w) + strokeD(d, col, n(w - 3.2));
// mitten hand: palm plus a thumb, in the body colour
const mitt = (x, y, r, deg, col) =>
  rot(ell(x - r * 0.75, y - r * 0.45, r * 0.36, r * 0.55, col, null, { sw: 2.2, attrs: `transform="rotate(-30 ${n(x - r * 0.75)} ${n(y - r * 0.45)})"` }) +
    ell(x, y, r, r * 0.9, col, null, { sw: 2.4 }), deg, x, y);
// rounded foot nub; d = +1 toe right, -1 toe left
const nub = (x, y, d, col, k = 1) =>
  shape(`M${n(x - 4 * k * d)} ${n(y)}Q${n(x - 4 * k * d)} ${n(y - 6 * k)} ${n(x + 2 * k * d)} ${n(y - 6 * k)}Q${n(x + 9 * k * d)} ${n(y - 6 * k)} ${n(x + 9 * k * d)} ${n(y)}Z`, col, null, { sw: 2.4 });
// tall oval eye clipped to its sclera, so the pupil can sit at the rim. o.lid / o.bl = top / bottom lid 0..1,
// o.tilt = top lid rotation in degrees, o.lc = lid colour (the surface behind the eye)
function ovalEye(cx, cy, rx, ry, px = 0, py = 0, o = {}) {
  const id = `c${++uid}`, pr = o.pr ?? rx * 0.55, wide = rx * 2;
  const el = `cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`;
  let s = `<clipPath id="${id}"><ellipse ${el}/></clipPath><ellipse ${el} fill="${o.sclera ?? C.white}"/><g clip-path="url(#${id})">` +
    `<circle cx="${n(cx + px)}" cy="${n(cy + py)}" r="${n(pr)}" fill="${C.plum}"/><circle cx="${n(cx + px - pr * 0.3)}" cy="${n(cy + py - pr * 0.4)}" r="${n(pr * 0.35)}" fill="${C.white}"/>`;
  if (o.lid) {
    const y0 = cy - ry + 2 * ry * o.lid;
    s += rot(`<rect x="${n(cx - wide)}" y="${n(cy - ry * 3)}" width="${n(wide * 2)}" height="${n(y0 - cy + ry * 3)}" fill="${o.lc}"/>` + line([[cx - wide, y0], [cx + wide, y0]], C.plum, 2.4), o.tilt || 0, cx, n(y0));
  }
  if (o.bl) {
    const y1 = cy + ry - 2 * ry * o.bl;
    s += `<rect x="${n(cx - wide)}" y="${n(y1)}" width="${n(wide * 2)}" height="${n(ry * 3)}" fill="${o.lc}"/>` + line([[cx - wide, y1], [cx + wide, y1]], C.plum, 1.8);
  }
  return s + `</g><ellipse ${el} fill="none" stroke="${C.plum}" stroke-width="${o.sw ?? 2.4}"/>`;
}

// spiral for a dizzy eye (draw over a white eye)
const spiral = (cx, cy, k = 1) =>
  strokeD(`M${n(cx + k)} ${n(cy)}a${n(k)} ${n(k)} 0 1 0 ${n(-2 * k)} 0a${n(2 * k)} ${n(2 * k)} 0 1 0 ${n(4 * k)} 0a${n(3 * k)} ${n(3 * k)} 0 1 0 ${n(-6 * k)} 0a${n(4 * k)} ${n(4 * k)} 0 1 0 ${n(8 * k)} 0`, C.plum, 1.8);
// sweat drop pointing up at (x, y); narrower than sweat() and recolourable
const drop = (x, y, s = 1, col = C.sky) =>
  shape(`M${n(x)} ${n(y)}Q${n(x + 3 * s)} ${n(y + 5 * s)} ${n(x)} ${n(y + 7 * s)}Q${n(x - 3 * s)} ${n(y + 5 * s)} ${n(x)} ${n(y)}Z`, col, null, { sw: 1.8 });
// big fist (brute style): knuckle bumps on top and a thumb, rotated by deg about its centre
const fist = (x, y, r, deg, col) =>
  rot(ell(x, y, r, r * 0.85, col, null, { sw: 2.6 }) +
    strokeD(`M${n(x - r * 0.5)} ${n(y - r * 0.55)}L${n(x - r * 0.5)} ${n(y - r * 0.1)}M${n(x)} ${n(y - r * 0.65)}L${n(x)} ${n(y - r * 0.15)}M${n(x + r * 0.5)} ${n(y - r * 0.55)}L${n(x + r * 0.5)} ${n(y - r * 0.1)}`, C.plum, 1.6) +
    ell(x - r * 0.85, y + r * 0.1, r * 0.32, r * 0.45, col, null, { sw: 2.2, attrs: `transform="rotate(-20 ${n(x - r * 0.85)} ${n(y + r * 0.1)})"` }), deg, x, y);
// sneaker; (x, y) = bottom of the ankle, d = +1 toe right / -1 toe left, k scales it (not shoe(): that one is the goblin's)
const sneaker = (x, y, d = 1, col = C.coral, k = 1) => {
  const a = (v) => v * k;
  return shape(`M${n(x - a(5) * d)} ${n(y)}L${n(x - a(5) * d)} ${n(y - a(6))}Q${n(x)} ${n(y - a(9))} ${n(x + a(4) * d)} ${n(y - a(5))}Q${n(x + a(11) * d)} ${n(y - a(4))} ${n(x + a(11) * d)} ${n(y)}Z`, col, null, { sw: 2.4 }) +
    shape([[x - a(6) * d, y], [x + a(12) * d, y], [x + a(12) * d, y + a(3)], [x - a(6) * d, y + a(3)]], C.white, null, { sw: 2.2 });
};
// row of k square teeth inside a box
const teethRow = (x, y, w, h, k = 4, col = C.white) => {
  let s = shape(rect(x, y, w, h), col, null, { sw: 2.2 });
  for (let i = 1; i < k; i++) s += line([[x + (w * i) / k, y], [x + (w * i) / k, y + h]], C.plum, 1.5);
  return s;
};
// plum teardrop seed shared by the melon and its slice; tip points up before deg
const melonSeed = (x, y, deg = 0, s = 1, col = C.plum) =>
  flat('M0 -3.4Q2.8 .6 0 3.6Q-2.8 .6 0 -3.4Z', col, `transform="translate(${n(x)} ${n(y)}) rotate(${deg}) scale(${s})"`);

const spark = (cx, cy, r, col = C.coral) =>
  shape(star(cx, cy, r, r * 0.42, 6, -80), col, null, { sw: SWs }) + flat(star(cx, cy, r * 0.5, r * 0.22, 6, -80), C.cream);

const ASSETS = {};
const inset = (w, h, inner, m = 2) => `<g transform="translate(${m} ${m}) scale(${+((w - 2 * m) / w).toFixed(4)} ${+((h - 2 * m) / h).toFixed(4)})">${inner}</g>`;
const add = (key, fn) => { ASSETS[key] = fn; };

// =====================================================================================
// GOBLIN
// =====================================================================================
// skin palettes (K is read by the goblin/cart drawing functions at call time)
const K0 = { skin: C.green, skinD: C.greenD, skinL: C.greenL, apron: C.cream, apronD: C.creamD, heart: C.coral, heartD: C.coralD, eye: C.gold,
  cf: C.chrome, cfD: C.chromeD, cfL: C.chromeL, grip: C.coral, gripD: C.coralD, gripL: C.coralL, hub: C.lavL };
let K = K0;
const shoe = (x, y, deg = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${deg})">` +
  shape([[-10, -6], [0, -9], [6, -8], [14, -1], [19, 3], [19, 7], [-10, 7]], C.coral, C.coralD, { sw: SWs + 0.5, dx: 2, dy: 3 }) +
  shape([[-10, 3], [18, 2.5], [19, 7], [-10, 7]], C.cream, C.creamD, { sw: SWs, dx: 0, dy: 1.5 }) +
  flat([[11, -2], [15, -1], [18.5, 2.5], [11, 2.5]], C.cream) +
  line([[1, -5], [5, -3.5]], C.plum, 1.6) + line([[4, -7], [8, -4.5]], C.plum, 1.6) + `</g>`;
const gLimb = (pts, w = 4.5) => tube(pts, w, K.skin, 1.8);

add('goblin_legs_a', () =>
  gLimb([[32, 6], [23, 22], [17, 33]]) + shoe(17, 37, -8) +
  gLimb([[32, 6], [39, 24], [41, 37]]) + shoe(41, 38, 0));
add('goblin_legs_b', () =>
  gLimb([[32, 6], [35, 20], [41, 30]]) + shoe(41, 31, -14) +
  gLimb([[32, 6], [31, 24], [30, 38]]) + shoe(29, 38, 0));

add('goblin_torso', () =>
  shape([[13, 6], [30, 3.5], [43, 8], [45, 28], [42, 40], [16, 41], [11, 24]], K.skin, K.skinD, { dx: 4, dy: 3 }) +
  flat([[17, 8], [28, 5], [30, 8], [20, 12]], K.skinL, 'opacity=".8"') +
  shape([[14, 36], [43, 34], [45, 50], [30, 52], [28, 44], [26, 52], [12, 50]], C.plum, null) +
  flat([[16, 38], [26, 37], [25, 40]], C.plumSoft) +
  shape([[19, 14], [37, 12], [40, 38], [18, 40]], K.apron, K.apronD, { dx: 3, dy: 3, sw: SWs + 0.5 }) +
  shape('M28 35 L21 28 Q18 23 22 21 Q26 19 28 24 Q31 19 35 21 Q38 24 35 28 Z', K.heart, K.heartD, { sw: SWs, dx: 1.5, dy: 1.5 }) +
  line([[19, 14], [15, 9]], C.plum, 2) + line([[37, 12], [39, 8]], C.plum, 2));

function goblinHead(mood) {
  const hurt = mood === 'hurt', shove = mood === 'shove';
  // ears
  const farEar = hurt ? [[56, 24], [70, 30], [82, 44]] : shove ? [[54, 24], [68, 28], [58, 6]] : [[50, 24], [70, 30], [78, 5]];
  const nearEar = hurt ? [[24, 30], [28, 50], [4, 56]] : shove ? [[23, 28], [30, 52], [4, 36]] : [[23, 22], [30, 56], [4, 13]];
  const nearIn = hurt ? [[23, 36], [26, 47], [9, 53]] : shove ? [[23, 35], [26, 45], [9, 36]] : [[23, 29], [27, 50], [10, 21]];
  let s = shape(farEar, K.skinD, null) + shape(nearEar, K.skin, K.skinD, { dx: 3, dy: 3 }) + flat(nearIn, '#F7A08F');
  s += shape([[20, 30], [34, 18], [56, 15], [68, 24], [72, 34], [80, 38], [91, 47], [80, 52], [71, 54], [67, 63], [56, 71], [38, 72], [23, 62], [16, 46]], K.skin, K.skinD, { dx: 4, dy: 4 });
  s += flat([[28, 30], [38, 22], [52, 19], [44, 26]], K.skinL, 'opacity=".85"');
  s += `<circle cx="83" cy="46" r="1.6" fill="${C.plum}"/><circle cx="44" cy="52" r="3.4" fill="#F7A08F" opacity=".85"/>`;
  const slit = (x, y, k) => shape([[x - 9, y + 1], [x - 2, y - 7 * k], [x + 9, y - 4 * k], [x + 3, y + 7 * k]], K.eye, null, { sw: 2.2 }) + `<circle cx="${x + 3}" cy="${y}" r="3.6" fill="${C.plum}"/><circle cx="${x + 4}" cy="${y - 1.2}" r="1.2" fill="${C.cream}"/>`;
  if (hurt) {
    s += line([[39, 31], [52, 37], [40, 43]], C.plum, 3.2) + line([[69, 31], [58, 36], [68, 42]], C.plum, 3.2);
    s += line([[36, 27], [48, 24]], C.plum, 3) + line([[60, 23], [72, 27]], C.plum, 3);
    s += shape([[43, 52], [52, 49], [58, 53], [67, 50], [66, 61], [58, 66], [48, 64]], C.plum, null, { sw: 1.5 }) +
      flat([[46, 52], [52, 50], [50, 55]], C.cream) + flat([[54, 64], [62, 62], [60, 58]], C.coral);
    s += shape('M12 62 Q16 54 20 62 Q20 68 16 68 Q12 68 12 62Z', C.sky, null, { sw: SWs });
  } else if (shove) {
    s += slit(45, 40, 0.6) + slit(63, 38, 0.6);
    s += brow(31, 24, 54, 37, 4.5) + brow(53, 25, 73, 35, 4.5);
    s += shape(rect(38, 52, 32, 11), C.plum, null, { sw: 1.5 }) + flat(rect(40, 53.5, 28, 3.5), C.cream) + flat(rect(40, 58.5, 28, 3), C.cream);
    for (let x = 46; x < 68; x += 7) s += line([[x, 53], [x, 62]], C.plum, 1.4);
    s += line([[30, 14], [24, 8]], C.coral, 2.5) + line([[40, 11], [38, 4]], C.coral, 2.5);
  } else {
    s += slit(45, 40, 1) + slit(63, 38, 1);
    s += brow(32, 28, 52, 35, 4) + brow(54, 25, 73, 31, 4);
    s += shape([[34, 54], [54, 60], [76, 51], [71, 64], [54, 70], [38, 65]], C.plum, null, { sw: 1.5 }) +
      flat([[40, 55.5], [47, 57.5], [44, 62]], C.cream) + flat([[58, 61], [66, 57], [67, 65]], C.cream) + flat([[44, 66], [54, 67], [50, 69.5]], C.coral);
  }
  return s;
}
add('goblin_head', () => goblinHead('idle'));
add('goblin_head_hurt', () => goblinHead('hurt'));
add('goblin_head_shove', () => goblinHead('shove'));

add('goblin_arm', () =>
  shape([[3, 8], [27, 7], [32, 5], [39, 4], [44, 11], [41, 18], [32, 19], [3, 17]], K.skin, K.skinD, { dx: 2, dy: 3, sw: SWs + 0.5 }) +
  shape([[26, 6], [32, 5], [32, 19], [26, 18]], C.cream, C.creamD, { dx: 1.5, dy: 2, sw: SWs }) +
  line([[36, 8], [41, 9]], C.plum, 1.6) + line([[36, 12], [42, 12.5]], C.plum, 1.6) + flat([[6, 9.5], [24, 9], [24, 11]], K.skinL, 'opacity=".8"'));

// ---------- starter accessories (head ones: +32px headroom, drawn in goblin_head coords) ----------
const onHead = (inner) => `<g transform="translate(0 32)">${inner}</g>`;
add('acc_toast_hat', () => onHead(
  `<g transform="translate(46 12) rotate(-16) scale(1.1)">` +
    shape('M-15 9 L-15 -5 Q-20 -10 -13 -16 Q-6 -20 0 -17 Q6 -20 13 -16 Q20 -10 15 -5 L15 9 Z', C.breadD, null) +
    flat('M-11 6 L-11 -4 Q-14 -9 -10 -12 Q-5 -15 0 -13 Q5 -15 10 -12 Q14 -9 11 -4 L11 6 Z', C.breadL) +
    flat([[-7, -9], [-2, -10], [-7, -3]], C.cream, 'opacity=".7"') + `<circle cx="5" cy="-2" r="1.3" fill="${C.breadD}"/><circle cx="-2" cy="2" r="1.1" fill="${C.breadD}"/></g>` +
  `<circle cx="22" cy="4" r="1.6" fill="${C.breadL}"/><circle cx="26" cy="9" r="1.1" fill="${C.breadD}"/>`));
add('acc_chef_hat', () => onHead(
  ell(36, 3, 9, 8, C.white, C.lavL, { sw: SWs + 0.5, dx: 2, dy: 2 }) + ell(58, 3, 9, 8, C.white, C.lavL, { sw: SWs + 0.5, dx: 2, dy: 2 }) +
  ell(47, -5, 11, 10, C.white, C.lavL, { sw: SWs + 0.5, dx: 2, dy: 2 }) +
  shape([[32, 13], [64, 11], [65, 25], [31, 26]], C.white, C.lavL, { sw: SWs + 0.5, dx: 2, dy: 3 }) +
  line([[40, 14], [40, 24]], C.lavL, 1.4) + line([[48, 13], [48, 25]], C.lavL, 1.4) + line([[56, 12], [56, 24]], C.lavL, 1.4)));
add('acc_apron', () =>
  shape([[16, 14], [39, 12], [43, 41], [15, 43]], C.white, C.lavL, { dx: 3, dy: 3, sw: SWs + 0.5 }) +
  line([[17, 14], [14, 8]], C.plum, 2) + line([[38, 12], [40, 7]], C.plum, 2) +
  shape(rect(21, 29, 15, 9), C.white, C.lavL, { sw: 1.6, dx: 1, dy: 1.5 }) +
  flat('M22 20 Q26 17 31 20 Q34 24 29 26 Q24 28 22 24Z', C.coral) + flat([[24, 20.5], [27, 19.5], [25, 22]], C.coralL) + `<circle cx="34" cy="28" r="1.6" fill="${C.coral}"/>`);
add('acc_visor', () => onHead(
  shape([[28, 25], [60, 20], [88, 29], [84, 34], [32, 31]], C.green, C.greenD, { dx: 2, dy: 3, sw: SWs + 0.5 }) +
  flat([[36, 25], [58, 22], [62, 24], [40, 27]], C.greenL, 'opacity=".8"') +
  `<circle cx="45" cy="40" r="10" fill="${C.sky}" fill-opacity=".3" stroke="${C.plum}" stroke-width="2.4"/><circle cx="64" cy="38" r="10" fill="${C.sky}" fill-opacity=".3" stroke="${C.plum}" stroke-width="2.4"/>` +
  line([[54, 39], [55, 38.5]], C.plum, 2.4) + line([[35, 40], [24, 38]], C.plum, 2.2) + flat([[40, 34], [46, 33], [41, 38]], C.white, 'opacity=".7"')));
add('acc_headlamp', () => onHead(
  flat([[66, 25], [96, 14], [96, 40]], C.gold, 'opacity=".28"') +
  shape([[25, 31], [27, 14], [42, 5], [60, 8], [70, 22], [71, 31]], C.lavD, C.plumSoft, { dx: 3, dy: 3, sw: SWs + 0.5 }) +
  shape([[24, 22], [71, 20], [73, 32], [25, 34]], C.plumSoft, C.plum, { dx: 2, dy: 3, sw: SWs + 0.5 }) +
  [32, 40, 48, 56, 64].map((x) => line([[x, 23], [x + 1, 32]], C.plum, 1.3)).join('') +
  shape(rect(61, 12, 13, 10), C.chrome, C.chromeD, { sw: SWs, dx: 1.5, dy: 2 }) + `<circle cx="73" cy="17" r="3.4" fill="${C.cream}" stroke="${C.gold}" stroke-width="1.6"/>`));

// =====================================================================================
// CART
// =====================================================================================
const wire = (x1, y1, x2, y2, w = 1.8) => line([[x1, y1], [x2, y2]], K.cfD, w);
const nudge = (x, y, inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
add('cart_back', () => nudge(3, 2, (() => {
  let s = '';
  // chassis: posts + lower tray rails
  s += tube([[36, 44], [40, 68]], 2.5, K.cf, 1.5) + tube([[104, 44], [100, 68]], 2.5, K.cf, 1.5);
  s += shape([[33, 55], [106, 55], [103, 61], [36, 61]], K.cf, K.cfD, { dx: 0, dy: 2, sw: SWs });
  s += tube([[36, 61], [41, 68]], 2.5, K.cf, 1.5) + tube([[102, 61], [99, 68]], 2.5, K.cf, 1.5);
  // back/inside of basket
  s += shape([[26, 7], [111, 5], [104, 42], [33, 44]], K.cfL, K.cf, { dx: 5, dy: 4 });
  for (const x of [44, 64, 84]) s += wire(x, 8, x - 3 + (x - 64) * 0.1, 42);
  s += wire(30, 24, 107, 23) + flat([[27, 7], [110, 5.5], [110, 11], [27, 12]], K.cfL);
  s += shape([[24, 4], [112, 2.5], [112, 9], [24, 11]], K.cfL, K.cf, { dx: 0, dy: 3 });
  // handle with coral grip at left
  s += tube([[26, 9], [18, 10]], 2.5, K.cf, 1.5) + tube([[34, 44], [24, 30], [20, 12]], 2.5, K.cf, 1.5);
  s += shape([[0, 5], [22, 2], [24, 11], [1, 15]], K.grip, K.gripD, { dx: 2, dy: 3 }) + flat([[3, 6], [18, 4], [18, 6]], K.gripL);
  return s;
})()));
add('cart_front', () => nudge(3, 2, (() => {
  let s = `<path d="${D([[22, 15], [112, 15], [106, 52], [32, 52]])}" fill="${C.frost}" opacity=".2"/>`;
  for (const x of [34, 46, 58, 70, 82, 94, 106]) s += wire(x + 0.2 * (x - 66) * 0.3, 18, x - 6 + (x - 66) * 0.16, 51);
  s += wire(26, 28, 110, 28) + wire(29, 40, 108, 40);
  s += line([[32, 52], [106, 52]], K.cfD, 3);
  s += line([[22, 15], [32, 52]], C.plum, 3.5) + line([[112, 15], [106, 52]], C.plum, 3.5);
  s += line([[22, 15], [32, 52]], K.cf, 1.6) + line([[112, 15], [106, 52]], K.cf, 1.6);
  s += shape([[20, 12], [114, 12], [113, 19], [21, 20]], K.cfL, K.cf, { dx: 0, dy: 3 });
  s += flat([[26, 13.5], [90, 13], [90, 15], [26, 16]], C.white, 'opacity=".9"');
  s += shape(rect(98, 21, 8, 5), C.coral, C.coralD, { dx: 0, dy: 1.5, sw: SWs }); // little child-seat latch tag
  return s;
})()));
add('cart_wheel', () =>
  ell(10, 10, 7.6, 7.6, C.plumSoft, C.plum, { sw: 1.6, dx: 2, dy: 2 }) +
  `<circle cx="10" cy="10" r="3.6" fill="${K.hub}" stroke="${C.plum}" stroke-width="1.4"/>` +
  line([[10, 3.6], [10, 16.4]], C.plum, 1) + line([[3.6, 10], [16.4, 10]], C.plum, 1) +
  `<path d="M4.5 6 A7 7 0 0 1 9 3" fill="none" stroke="${C.lav}" stroke-width="1.6" stroke-linecap="round"/>`);
add('shadow', () => shadowE(64, 20, 61, 17.5));

// =====================================================================================
// ENEMIES
// =====================================================================================
function milk(f) {
  if (f !== 'a' && f !== 'b' && f !== 'hurt') throw new Error(`milk: unknown frame "${f}"`);
  const W = C.white, cr = C.cream, pl = C.plum, a = f === 'a';
  const limbS = (d, col) => limb(d, col, 5.6);
  const caneArt = (d, wo, wi, dash) => strokeD(d, pl, wo) + strokeD(d, C.coral, wi) + `<path d="${d}" fill="none" stroke="${W}" stroke-width="${wi}" stroke-dasharray="${dash} ${dash}"/>`;
  const browL = 'M14 38Q15 33 19 35Q21 31 25 34Q28 32 30 36Q24 38 14 38Z', browR = 'M47 38Q46 33 42 35Q40 31 36 34Q33 32 31 36Q37 38 47 38Z';
  const carton = shape('M17 11L42 10L43 21L16 21Z', C.blue, null) + strokeD('M22 12L22 20', pl, 1.6) + strokeD('M28 12L28 20', pl, 1.6) + strokeD('M34 12L34 20', pl, 1.6) +
    shape('M44 21L54 18L58 30L48 33Z', C.creamD, null) + shape('M16 21L44 21L48 33L12 33Z', cr, null) +
    shape('M48 33L58 30L58 74L48 79Z', C.creamD, null) + shape('M12 33L48 33L48 79L12 77Z', cr, null) + shape('M12 68L48 69L48 79L12 77Z', C.blue, null);
  if (f === 'hurt') {
    // leaning back and squashed, eyes squeezed, "ow" mouth, glasses cracked and knocked askew, cane tumbling away
    let b = '';
    b += limbS('M24 77L21 87', cr) + limbS('M40 78L45 85', cr) + nub(20, 91, -1, C.lav) + nub(46, 89, 1, C.lav);
    b += limbS('M13 50Q10 45 13 38', cr) + mitt(13, 35, 4.5, 25, cr);
    b += carton;
    b += `<g transform="translate(0 -5) rotate(-15 22 36)">${shape(browL, W, null, { sw: 2 })}</g><g transform="translate(0 -5) rotate(15 39 36)">${shape(browR, W, null, { sw: 2 })}</g>`;
    b += strokeD('M19 43L28 48.5L19 54', pl, 3.6) + strokeD('M42 43L33 48.5L42 54', pl, 3.6);
    b += `<g transform="translate(2 -12) rotate(-20 30.5 46)"><circle cx="23" cy="46" r="7.5" fill="${C.sky}" fill-opacity=".22" stroke="${pl}" stroke-width="2.2"/><circle cx="38" cy="46" r="7.5" fill="${C.sky}" fill-opacity=".22" stroke="${pl}" stroke-width="2.2"/>${strokeD('M15.5 45L10 41', pl, 1.8)}${strokeD('M45.5 45L51 43', pl, 1.8)}${strokeD('M20 42L24 46.5L21 51', pl, 1.3)}${strokeD('M33 42L35 40', W, 1.4)}</g>`;
    b += shape('M22 62Q26 57 30 61Q34 57 38 62Q42 69 37 72Q31 75 25 72Q19 69 22 62Z', pl, null, { sw: 2 }) + flat('M26 69Q31 65 36 69Q34 73 31 73Q28 73 26 69Z', C.coralL);
    b += limbS('M57 54Q64 50 63 42', cr) + mitt(63, 39, 4.5, -25, cr);
    let fx = `<g transform="translate(51 13) rotate(105) scale(.58) translate(-62 -68)">${caneArt('M66 92L66 50Q66 43 61 43Q57 43 57 47', 6.5, 3.4, 3.5)}</g>`;
    fx += strokeD('M61 6L68 4', C.lav, 1.8) + strokeD('M60 22L68 22', C.lav, 1.8) + strokeD('M31 5L37 3', C.lav, 1.8);
    fx += shape(star(8, 12, 5, 2.2, 5), C.gold, null, { sw: 1.6 }) + shape(star(66, 28, 4, 1.8, 5), C.gold, null, { sw: 1.6 });
    fx += drop(6, 60, 1) + drop(64, 62, 0.9);
    // translate(3 -3.7): the lean pushes the planted left toe 2.5 below its nub, this brings its outline back onto the 91.2 ground line
    return `<g transform="translate(3 -3.7) rotate(-8 30 91)"><g transform="translate(30 91) scale(1.05 .94) translate(-30 -91)">${b}</g></g>${fx}`;
  }
  // a = standing, b = walk partner: left foot lifted, body bobbed up, free arm swung up, cane lifted with the body.
  // The cane stops level with the feet and the whole figure drops -1 so the foot outlines sit on the 91.2 ground line.
  const legs = a ? limbS('M24 77L23 87', cr) + limbS('M40 78L41 87', cr) + nub(22, 91, -1, C.lav) + nub(42, 91, 1, C.lav)
    : limbS('M24 74L19 83', cr) + limbS('M40 74L41 87', cr) + nub(18, 88, -1, C.lav) + nub(42, 91, 1, C.lav);
  let up = strokeD('M50 9l3 -4l2 4l3 -4l2 4', pl, 1.8);
  up += a ? limbS('M13 50Q5 56 9 63', cr) + mitt(10, 65, 4.5, 10, cr) : limbS('M13 50Q7 51 8 57', cr) + mitt(8.5, 59, 4.5, 0, cr);
  up += carton;
  up += ovalEye(23, 46, 4.6, 5, 1.2, 1, { lid: 0.5, tilt: 8, lc: C.creamD }) + ovalEye(38, 46, 4.6, 5, -1.2, 1, { lid: 0.5, tilt: -8, lc: C.creamD });
  up += `<circle cx="23" cy="46" r="7.5" fill="${C.sky}" fill-opacity=".22" stroke="${pl}" stroke-width="2"/><circle cx="38" cy="46" r="7.5" fill="${C.sky}" fill-opacity=".22" stroke="${pl}" stroke-width="2"/>` +
    strokeD('M15.5 45L12 43', pl, 1.6) + strokeD('M45.5 45L48 43', pl, 1.6) + strokeD('M18 42L20 40', W, 1.4) + strokeD('M33 42L35 40', W, 1.4);
  up += shape(browL, W, null, { sw: 2 }) + shape(browR, W, null, { sw: 2 });
  up += strokeD('M19 57Q23 59 27 57', pl, 1.3) + strokeD('M34 57Q38 59 42 57', pl, 1.3);
  up += shape('M23 64Q31 57 39 64Q31 61.5 23 64Z', pl, null, { sw: 2 }) + strokeD('M28 67.5Q31 66 34 67.5', pl, 1.4);
  const prop = caneArt('M66 89.5L66 50Q66 43 61 43Q57 43 57 47', 5.5, 2.8, 3) + limbS('M58 54Q63 56 65 52', cr) + mitt(66, 52, 4.5, -10, cr);
  const bob = (dy, inner) => `<g transform="translate(0 ${dy})">${inner}</g>`;
  return `<g transform="translate(0 -1)">${legs}${a ? up + prop : bob(-1.5, up + bob(-1.5, prop))}</g>`;
}
add('enemy_milk_a', () => milk('a'));
add('enemy_milk_b', () => milk('b'));
add('enemy_milk_hurt', () => milk('hurt'));

function banana(f) {
  if (f !== 'a' && f !== 'b' && f !== 'tell' && f !== 'hurt') throw new Error(`banana: unknown frame "${f}"`);
  const T = f === 'tell', H = f === 'hurt', a = f === 'a', c = C.banana, W = C.white, pl = C.plum;
  // every frame is drawn on a y=92 ground, the wrappers below drop it +2 so the boot outlines sit on the 95 ground line (tell also -0.5 to stay inside the canvas)
  const limbS = (d) => limb(d, c, 5.6);
  const BODY = 'M31 26Q44 16 54 30Q62 48 55 70Q49 82 37 80Q31 68 30 52Q28 38 31 26Z';
  const boot = (x, y, d) => shape(`M${x - 4 * d} ${y}L${x - 4 * d} ${y - 8}L${x + 3 * d} ${y - 8}L${x + 3 * d} ${y - 4}Q${x + 10 * d} ${y - 4} ${x + 10 * d} ${y}Z`, C.breadD, null, { sw: 2.2 }) + flat(star(x - 6 * d, y - 2, 2.6, 1.1, 5), C.gold);
  const hat = (t) => `<g transform="${t}">${shape('M34 19Q34 6 43 7Q52 6 52 19Z', C.breadD, null)}${flat('M36 17Q36 9 41 8.5Q38 12 38.5 17Z', C.breadL)}${shape('M34 15.5L52 15.5L52 19L34 19Z', pl, null, { sw: 1 })}${shape('M21 21Q43 13 65 19Q61 25 43 24Q27 25 21 21Z', C.breadD, null)}</g>`;
  const dots = (pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="${W}"/>`).join('');
  let pre = '', b = '';
  if (T) {
    pre += strokeD('M4 40L16 40', C.lav, 2.5) + strokeD('M2 52L13 52', C.lav, 2.5) + strokeD('M6 64L16 64', C.lav, 2.5);
    pre += limbS('M40 78Q33 82 27 83') + boot(25, 87, -1) + limbS('M49 76Q55 84 57 88') + boot(57, 92, 1);
  } else if (a || H) pre += limbS('M40 78Q34 84 35 88') + limbS('M49 76Q55 84 54 88') + boot(35, 92, -1) + boot(54, 92, 1);
  else pre += limbS('M40 78Q32 82 28 85') + boot(28, 89, -1) + limbS('M49 76Q55 84 54 88') + boot(54, 92, 1); // walk partner: left foot lifted
  if (H) pre += shape(star(14, 22, 6, 2.6, 5), C.gold, null, { sw: 1.6 }) + shape(star(68, 16, 5, 2.2, 5), C.gold, null, { sw: 1.6 });
  b += flat(BODY, c) + flat('M53 29Q62 48 55 70Q49 82 37 80Q48 73 52 60Q57 44 53 29Z', C.bananaD) + flat('M33 33Q37 25 43 21Q38 31 36 45Z', C.bananaL) + strokeD(BODY, pl, 3);
  b += `<circle cx="35" cy="72" r="1.4" fill="${C.breadD}"/><circle cx="56" cy="58" r="1.2" fill="${C.breadD}"/>`;
  if (H) {
    b += `<ellipse cx="38" cy="41" rx="5" ry="6" fill="${W}" stroke="${pl}" stroke-width="2.2"/><ellipse cx="49.5" cy="40.5" rx="5" ry="6" fill="${W}" stroke="${pl}" stroke-width="2.2"/>` + spiral(38, 41) + spiral(49.5, 40.5);
    b += strokeD('M32 33L42 30', pl, 3) + strokeD('M56 32L46 29.5', pl, 3);
    b += shape('M37 51Q41 48 45 51Q49 48 53 51Q52 58 45 58Q38 58 37 51Z', pl, null, { sw: 2 }) + shape('M41 56Q45 54 49 56Q47 58 45 58Q43 58 41 56Z', C.coralL, null, { sw: 1.2 });
    b += shape('M31 62Q43 60 56 58L55 64Q48 76 41 77Q35 72 32 68Z', C.coral, null, { sw: 2.5 }) + dots([[39, 66], [47, 64], [43, 71]]);
    b += limbS('M31 52Q20 46 17 37') + mitt(17, 34, 4.4, -30, c) + limbS('M56 50Q67 44 67 35') + mitt(67, 32, 4.4, 30, c);
    b += hat('translate(5 4) rotate(18 43 20)');
    return `<g transform="translate(0 2)">${pre}<g transform="translate(44 92) scale(1.08 .9) translate(-44 -92)">${b}</g></g>`;
  }
  b += shape('M31 52L22 49L24 56Z', C.coralD, null, { sw: 2 }) + shape('M31 55L23 60L28 62Z', C.coralD, null, { sw: 2 });
  b += shape('M30 51Q43 48 57 47L56 54Q48 70 41 71Q35 64 31 58Z', C.coral, null, { sw: 2.5 }) + dots([[38, 56], [46, 55], [52, 52], [42, 63]]);
  if (T) {
    b += ovalEye(38, 41, 5.5, 6.8, 2.5, 0, { pr: 2.4 }) + ovalEye(49.5, 40.5, 5.5, 6.8, 2.5, 0, { pr: 2.4 }) + strokeD('M31 31L42 36', pl, 3.5) + strokeD('M56 30L45 35', pl, 3.5);
    b += limbS('M31 55Q22 58 15 54') + mitt(13, 53, 4.4, 90, c) + limbS('M56 54Q63 57 67 52') + mitt(68, 51, 4.6, 0, c);
    return `<g transform="translate(-0.5 2)">${pre}<g transform="rotate(10 44 90)">${b}</g>` + strokeD('M14 10L20 14', C.lav, 2) + strokeD('M10 18L17 20', C.lav, 2) + hat('translate(-12 -4) rotate(-25 43 20)') + '</g>';
  }
  b += ovalEye(38, 41, 5, 6.2, 2.8, 0.5, { lid: 0.38, tilt: 8, bl: 0.22, lc: c }) + ovalEye(49.5, 40.5, 5, 6.2, 2.8, 0.5, { lid: 0.38, tilt: -8, bl: 0.22, lc: c });
  b += strokeD('M32 32L42 35', pl, 3) + strokeD('M45 31Q50 28 55 31', pl, 3);
  // a: arms hanging; b: left arm swung up and out, right arm swung down and out
  b += a ? limbS('M31 55Q24 62 25 70') + mitt(26, 72, 4.4, 0, c) + limbS('M56 55Q62 62 61 70') + mitt(61, 72, 4.4, 0, c) + strokeD('M66 68L69 66', pl, 1.6) + strokeD('M67 73L70 73', pl, 1.6)
    : limbS('M31 55Q22 57 21 65') + mitt(21.5, 67, 4.4, 0, c) + limbS('M56 55Q64 63 64 71') + mitt(64, 73, 4.4, 0, c) + strokeD('M69 69L72 67', pl, 1.6) + strokeD('M70 74L73 74', pl, 1.6);
  b += hat('rotate(-8 43 20)');
  return `<g transform="translate(0 2)">${pre}${a ? b : `<g transform="translate(0 -1.5)">${b}</g>`}</g>`;
}
add('enemy_banana_a', () => banana('a'));
add('enemy_banana_b', () => banana('b'));
add('enemy_banana_tell', () => banana('tell'));
add('enemy_banana_hurt', () => banana('hurt'));

function soda(f) {
  if (f !== 'a' && f !== 'b' && f !== 'tell' && f !== 'hurt') throw new Error(`soda: unknown frame "${f}"`);
  const T = f === 'tell', H = f === 'hurt', a = f === 'a';
  const W = C.white, pl = C.plum, SO = C.soda, SOD = C.sodaD, CO = C.coral, COD = C.coralD, COL = C.coralL, GO = C.gold, SKY = C.sky, PS = C.plumSoft, LAV = C.lav;
  const CX = [29, 55, 81], B = 72, EY = 37.8, BT = 59; // can centres, bottom of the front slab, eye line, top of the chest band
  const col = T ? CO : SO, colD = T ? COD : SOD;
  const lift = (s) => `<g transform="translate(0 ${H ? -1.8 : -1.4})">${s}</g>`; // puts the planted feet's outline on the ground line
  // white foam cloud: plum blob first, white on top so overlaps leave no inner lines
  const foam = (cs) => cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${pl}" stroke="${pl}" stroke-width="3.4"/>`).join('') + cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${W}"/>`).join('');
  // chrome can top with a pull-tab; open = tab popped and the hole dark
  const top = (x, y, open) => `<ellipse cx="${x}" cy="${y}" rx="11.5" ry="3.8" fill="${C.chrome}" stroke="${pl}" stroke-width="2.2"/>` +
    (open ? `<ellipse cx="${x - 1}" cy="${y}" rx="6.5" ry="1.9" fill="${PS}"/>` + strokeD(`M${x + 4} ${y - 1}L${x + 8} ${y - 3}`, C.chromeD, 2.2)
      : `<ellipse cx="${x + 1}" cy="${y + 0.2}" rx="4.2" ry="1.5" fill="${C.chromeL}" stroke="${pl}" stroke-width="1.5"/>`);
  // the yoke worn like a tank top: shoulder straps over the outer cans, a scooped neckline under the face, a wide chest band. Hurt: crushed right strap.
  const yoke = () => {
    const R = H ? `L93 ${BT}Q86.5 ${BT} 86.5 53L82 49L86.5 45.6L86.5 38.5L78 36.9L78 50` : `L93 ${BT}Q86.5 ${BT} 86.5 50L86.5 26L78 26L78 50`;
    const d = `M23.5 26L23.5 50Q23.5 ${BT} 17 ${BT}L15 ${BT}Q12 ${BT} 12 ${BT + 3}L12 ${B - 2.5}Q12 ${B + 0.5} 15 ${B + 0.5}L95 ${B + 0.5}Q98 ${B + 0.5} 98 ${B - 2.5}L98 ${BT + 3}Q98 ${BT} 95 ${BT}${R}Q78 ${BT} 71 ${BT}L39 ${BT}Q32 ${BT} 32 50L32 26Z`;
    return shape(d, C.frost, null, { sw: 2.6 })
      + flat(`M13.5 ${B - 5}L96.5 ${B - 5}L96.5 ${B - 2.5}Q96.5 ${B - 1} 95 ${B - 1}L15 ${B - 1}Q13.5 ${B - 1} 13.5 ${B - 2.5}Z`, C.frostD, 'fill-opacity=".55"')
      + flat('M26 29L27.8 29L27.8 49L26 49Z', W, 'fill-opacity=".85"') + (H ? '' : flat('M81 29L82.8 29L82.8 49L81 49Z', W, 'fill-opacity=".85"'))
      + strokeD(`M42 ${BT + 1}L42 ${B - 1}M68 ${BT + 1}L68 ${B - 1}`, pl, 1.8);
  };
  const cans = () => {
    let b = '';
    for (const cx of CX) b += shape(`M${cx - 12} 11L${cx - 12} 40L${cx + 12} 40L${cx + 12} 11Z`, col, null) + flat(`M${cx + 6} 12L${cx + 10.5} 12L${cx + 10.5} 39L${cx + 6} 39Z`, colD);
    for (const cx of CX) b += top(cx, 10, T);
    // front slab: three cans with scalloped feet
    const x0 = CX.map((c) => c - 13), x1 = CX.map((c) => c + 13);
    let slab = `M16 25L16 ${B - 4}`;
    CX.forEach((c, i) => { slab += `Q${x0[i]} ${B} ${x0[i] + 5} ${B}L${x1[i] - 5} ${B}Q${x1[i]} ${B} ${x1[i]} ${B - 4}`; });
    slab += H ? 'L94 58L82 49L94 40Z' : 'L94 25Z';
    b += flat(slab, col);
    for (let i = 0; i < 3; i++) b += flat(`M${x1[i] - 7} 30L${x1[i] - 1} 30L${x1[i] - 1} ${B - 4}Q${x1[i] - 2} ${B - 1} ${x1[i] - 5} ${B - 1}L${x1[i] - 7} ${B - 1}Z`, colD);
    b += strokeD(slab, pl, 3);
    // can seams, kept clear of the eyes
    for (const x of [x1[0], x1[1]]) b += strokeD(`M${x} 25L${x} 30M${x} 48L${x} ${BT}`, pl, 2.2);
    b += yoke();
    for (const cx of CX) b += top(cx, 24, T);
    return b;
  };
  const features = () => {
    if (H) {
      return strokeD('M38 33.5L52 39L38 44.5', pl, 3.6) + strokeD('M72 33.5L58 39L72 44.5', pl, 3.6)
        + shape('M48.5 47Q51 44 55 47Q59 44 61.5 47Q62.5 55 55 55Q47.5 55 48.5 47Z', pl, null, { sw: 2 }) + shape('M51.5 52Q55 50 58.5 52Q57 55 55 55Q53 55 51.5 52Z', COL, null, { sw: 1.2 });
    }
    if (T) {
      return ovalEye(44.5, EY, 8, 8.6, 1.6, 1.2, { pr: 3.9, sclera: COL, lid: 0.4, tilt: 15, lc: CO }) + ovalEye(65.5, EY, 8, 8.6, -1.6, 1.2, { pr: 3.9, sclera: COL, lid: 0.4, tilt: -15, lc: CO })
        + teethRow(45, 49.5, 20, 7.5, 5, W);
    }
    // stern bouncer mouth: flat, a touch down at the ends, with a visible lower lip
    return ovalEye(44.5, EY, 8, 8.6, 1.4, 1.2, { pr: 3.9, lid: 0.4, tilt: 7, lc: SO }) + ovalEye(65.5, EY, 8, 8.6, -1.4, 1.2, { pr: 3.9, lid: 0.4, tilt: -7, lc: SO })
      + strokeD('M49 52.2Q55 49.6 61 52.2', pl, 3.2) + strokeD('M52.2 55Q55 56.6 57.8 55', pl, 1.8);
  };
  // legs: a = both planted, b = walk partner with the right foot lifted (only the body layer bobs, the planted foot stays)
  const legs = a || T || H ? limb(`M38 ${B - 2}L37 76`, col, 7) + limb(`M72 ${B - 2}L73 76`, col, 7) + nub(35, 80, -1, PS, 1.3) + nub(75, 80, 1, PS, 1.3)
    : limb(`M38 ${B - 4}L37 76`, col, 7) + limb(`M72 ${B - 4}L75 74`, col, 7) + nub(35, 80, -1, PS, 1.3) + nub(77, 77, 1, PS, 1.3);
  let b = cans() + features();
  if (T) {
    b += limb('M17 52Q6 57 8 67', col, 7) + mitt(8, 69, 5.6, 0, col);
    b += limb('M93 52Q104 57 102 67', col, 7) + mitt(102, 69, 5.6, 0, col);
    let post = rays([[5, 30, 10, 33], [4, 42, 9, 43], [105, 30, 100, 33], [106, 42, 101, 43]], LAV, 2.6);
    for (const cx of CX) post += foam([[cx - 6, 13, 4], [cx, 11, 5.4], [cx + 6, 13, 4], [cx - 3, 6.5, 3.2], [cx + 3, 6.5, 3.2]]);
    post += drop(18, 12, 0.9, W) + drop(41, 8, 0.8, W) + drop(69, 8, 0.8, W) + drop(92, 12, 0.9, W);
    post += drop(15, 44, 1, SKY) + drop(96, 38, 1, SKY);
    return lift(`<g transform="translate(55 80) scale(.92 .92) translate(-55 -80)">${legs + b}</g>` + post);
  }
  if (H) {
    b += limb('M17 52Q10 46 14 35', col, 7) + mitt(14, 32, 5.6, -20, col) + limb('M94 59Q106 52 102 34', col, 7) + mitt(102, 31, 5.6, 20, col);
    // dented right can: a crushed notch, crease lines and a fizz leak
    b += strokeD('M76 44L72 48M76 54L72 52', colD, 2);
    b += foam([[95.5, 49, 4.6], [99, 43, 3.2], [99.5, 55, 3.2]]) + drop(96, 33, 0.8, W) + drop(106, 32, 0.7, SKY) + rays([[97, 61, 102, 65], [99, 57, 105, 60]], LAV, 2);
    b += shape(star(15, 22, 6, 2.6, 5), GO, null, { sw: 1.6 }) + shape(star(94, 17, 5, 2.2, 5), GO, null, { sw: 1.6 });
    b += drop(42, 15, 0.9, SKY);
    return lift(`<g transform="rotate(-4 35 80)">${legs + b}</g>`);
  }
  // arms crossed in an X over the chest band: the underneath arm is the darker shade
  b += limb('M16 47Q4 54 8 70L72 59', colD, 8) + mitt(76, 58, 5.6, 8, colD);
  b += limb('M94 47Q106 54 102 70L38 59', col, 8) + mitt(34, 58, 5.6, -8, col);
  return lift(a ? legs + b : `${legs}<g transform="translate(0 -1.5)">${b}</g>`);
}
add('enemy_soda_a', () => soda('a'));
add('enemy_soda_b', () => soda('b'));
add('enemy_soda_tell', () => soda('tell'));
add('enemy_soda_hurt', () => soda('hurt'));

function spitter(f) {
  if (!['a', 'b', 'tell', 'hurt'].includes(f)) throw new Error(`spitter: unknown frame "${f}"`);
  const JT = C.det, JTD = C.detD, CO = C.coral, COD = C.coralD, COL = C.coralL, W = C.white, CR = C.cream, CRD = C.creamD,
    SKY = C.sky, PL = C.plum, LAV = C.lav, GO = C.gold;
  const ln = (d, w = 3, col = PL) => strokeD(d, col, w);
  const limbS = (d, c = JT) => limb(d, c, 5.6);
  const bub = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${SKY}" fill-opacity=".6" stroke="${PL}" stroke-width="1.8"/><circle cx="${n(x - r * 0.35)}" cy="${n(y - r * 0.38)}" r="${n(Math.max(r * 0.26, 0.8))}" fill="${W}"/>`;
  // popping bubble: broken ring with ticks
  const pop = (x, y, r) => {
    let s = `<circle cx="${x}" cy="${y}" r="${n(r * 0.6)}" fill="${SKY}" fill-opacity=".5"/>`;
    s += ln(`M${n(x - r * 0.6)} ${y}A${n(r * 0.6)} ${n(r * 0.6)} 0 0 1 ${n(x + r * 0.1)} ${n(y - r * 0.6)}`, 1.8);
    for (const deg of [-20, 50, 130, 200, 260]) {
      const t = (deg * Math.PI) / 180;
      s += ln(`M${n(x + Math.cos(t) * r * 0.85)} ${n(y + Math.sin(t) * r * 0.85)}L${n(x + Math.cos(t) * r * 1.35)} ${n(y + Math.sin(t) * r * 1.35)}`, 1.8);
    }
    return s;
  };
  const BODY = 'M30 28Q34 22 41 22Q48 22 52 28L60 33Q66 38 66 46L66 68Q66 80 55 80L27 80Q16 80 16 68L16 46Q16 38 22 33Z';
  const HANDLE = 'M21 34Q7 32 7 44Q8 55 19 54';
  // the jug with its label and highlight (no face)
  const jug = (body = BODY, handle = HANDLE) => {
    let b = limb(handle, JT, 8);
    b += shape(body, JT, JTD, { sw: 3, dx: 4, dy: 3 });
    b += flat('M21 42Q21 38 25 36L29 38Q25 40 25 50Z', SKY, 'opacity=".75"');
    b += clipTo(body, `<rect x="8" y="67" width="68" height="16" fill="${CR}"/>${ln('M8 67L76 67', 2)}<path d="M52 67L74 67L74 82L45 82Z" fill="${CRD}"/>`) + ln(body, 3);
    b += drop(41, 67.8, 1.5, CO) + flat('M38.6 73.4Q38.6 71.6 40 70.8Q39.6 72.4 40.2 73.8Z', COL);
    return b;
  };
  // the backwards cap: the brim peeks out behind the head to the right
  const cap = (t) => `<g transform="${t}">` +
    shape('M52 24Q65 19 74 26Q70 33 54 30Z', COD, null, { sw: 2.6 }) +
    shape('M27 29Q25 12 41 11Q57 12 55 29Q41 33 27 29Z', CO, COD, { sw: 3, dx: 3, dy: 3 }) +
    ln('M41 13L41 27', 1.6) + ln('M32 16Q30 22 30 28', 1.6) +
    dot(41, 11.4, 2.3, COD, 1.6) +
    shape('M33 23.5L49 23.5L49 28.8Q41 31 33 28.8Z', COD, null, { sw: 1.8 }) + shape('M38.5 22.8L43.5 22.8L43.5 28.8L38.5 28.8Z', GO, null, { sw: 1.6 }) +
    `</g>`;
  // the bare jug neck and white screw cap (shown once the cap is gone)
  const spout = () => shape('M35 15L47 15L49 27L33 27Z', JT, null, { sw: 2.6 }) + shape('M32 7L50 7L51 16L31 16Z', W, null, { sw: 2.8 }) + ln('M36 8.5L36 14.5', 1.6) + ln('M41 8.5L41 14.5', 1.6) + ln('M46 8.5L46 14.5', 1.6);
  const legs = (wide) => wide
    ? limbS('M28 78Q23 84 20 86') + nub(18, 91, -1, CO) + limbS('M54 78Q59 84 62 86') + nub(64, 91, 1, CO)
    : limbS('M31 79L30 86') + nub(28.5, 91, -1, CO) + limbS('M51 79L52 86') + nub(52.5, 91, 1, CO);
  // half-lidded smug eyes, one brow cocked, smirk with a drip
  const smirk = () => ovalEye(34, 44, 5, 6.4, 2.2, 0.6, { lid: 0.42, tilt: -3, lc: JT }) + ovalEye(48.5, 44, 5, 6.4, 2.2, 0.6, { lid: 0.42, tilt: 3, lc: JT }) +
    ln('M27.5 36L40 36.8', 3.2) + ln('M43 35Q49 30.5 55 34.5', 3.2) +
    shape('M32 54.5Q42 56.5 52 52.5Q51 62.5 42 62.5Q33.5 62.5 32 54.5Z', PL, null, { sw: 2.2 }) + flat('M34 55.2Q42 57 50.5 54L50 57Q42 59 34.6 57.6Z', W) + flat('M37 60.8Q42 58.6 47 60.8Q46 62 42 62Q38 62 37 60.8Z', COL) +
    shape('M50 59Q55 60.5 54 66.5Q52 71 49.5 67Q48.5 62.5 50 59Z', SKY, null, { sw: 1.9 }) + flat('M51.5 62Q52.4 63 52 65', W) + drop(53.5, 71.5, 0.8, SKY);
  // game sprite anchor: nub soles must end on y = 0.95 * 96
  const grounded = (inner) => `<g transform="translate(0 -1)">${inner}</g>`;

  if (f === 'a') {
    // left arm hangs, right hand on the hip
    return grounded(legs() + jug() +
      limbS('M16 67Q8 71 10 78') + mitt(10.5, 80, 4.4, 0, JT) +
      limbS('M65 60Q77 60 76 68Q75 72 68 72') + mitt(67.5, 73, 4.4, -80, JT) +
      smirk() + cap('rotate(6 41 28)'));
  }
  if (f === 'b') {
    // left foot planted, right foot lifted and forward; body bobbed up, arms swung the other way
    const feet = limbS('M31 79L30 86') + nub(28.5, 91, -1, CO) + limbS('M51 79Q55 80 57 82') + nub(58, 87.5, 1, CO);
    const upper = jug() +
      limbS('M16 67Q12 70 15 76') + mitt(15.5, 78, 4.4, 0, JT) +
      limbS('M65 61Q78 62 76 69Q75 73 68 73') + mitt(67.5, 74, 4.4, -80, JT) +
      smirk() + cap('rotate(6 41 28)');
    return grounded(feet + `<g transform="translate(0 -1.5)">${upper}</g>`);
  }
  if (f === 'tell') {
    const BODY_T = 'M30 28Q34 22 41 22Q48 22 52 28L62 33Q70 38 70 46L70 68Q70 80 59 80L23 80Q12 80 12 68L12 46Q12 38 20 33Z';
    const HANDLE_T = 'M17 35Q9 33 9 44Q10 54 16 53';
    let pre = rays([[3, 22, 9, 26], [2, 33, 7, 35]], LAV, 2.4) + rays([[81, 22, 75, 26], [82, 33, 77, 35]], LAV, 2.4);
    pre += limbS('M25 78Q21 83 19 86') + nub(17, 91, -1, CO) + limbS('M57 78Q61 83 63 86') + nub(65, 91, 1, CO);
    let g = jug(BODY_T, HANDLE_T);
    // arms pulled back, fists clenched
    g += limbS('M13 67Q7 72 8 78') + mitt(8, 80, 4.8, 0, JT);
    g += limbS('M69 67Q75 72 74 78') + mitt(74, 80, 4.8, 0, JT);
    // ballooned cheeks on the face
    g += dot(21, 60, 8.5, JT, 3) + flat('M15.5 56.5Q16 53 19.5 52Q17 55 17 58Z', SKY, 'opacity=".8"') + `<path d="M19 67.5Q24 69.5 28 66Q25 71.5 19 67.5Z" fill="${JTD}"/>`;
    g += dot(61, 60, 8.5, JT, 3) + flat('M55.5 56.5Q56 53 59.5 52Q57 55 57 58Z', SKY, 'opacity=".8"') + `<path d="M59 67.5Q64 69.5 68 66Q65 71.5 59 67.5Z" fill="${JTD}"/>`;
    // bulging bloodshot eyes: coral sclera
    g += ovalEye(34, 43, 6.6, 8.2, 1.4, 0, { pr: 2.7, sclera: CO, sw: 2.8 }) + ovalEye(48.5, 43, 6.6, 8.2, -1.4, 0, { pr: 2.7, sclera: CO, sw: 2.8 });
    g += ln('M25.5 33L39 38', 3.6) + ln('M57 33L43.5 38', 3.6);
    // lips pushed out, a big bubble swelling from them
    g += ell(41.5, 58, 6, 4.2, PL, null, { sw: 2.4 });
    g += bub(41.5, 65.5, 7);
    g += cap('rotate(-8 41 28)');
    let b = `<g transform="rotate(-3 41 90)">${g}</g>`;
    // the fan of blobs about to fly
    b += bub(74, 40, 3) + bub(77.5, 49, 2.1) + bub(71, 31, 2);
    return grounded(pre + b);
  }
  // hurt
  let pre = shape(star(70, 11, 5.5, 2.4, 5), GO, null, { sw: 1.6 }) + shape(star(77, 24, 3.6, 1.6, 5), GO, null, { sw: 1.4 });
  // pop! bubbles
  pre += pop(72, 36, 5.4) + pop(70, 70, 4.2) + pop(8, 68, 4.2);
  pre += legs();
  let g = jug();
  g += limbS('M17 66Q10 68 8.5 61') + mitt(8.5, 58, 4.4, -20, JT) + limbS('M65 62Q69 58 70.5 51') + mitt(70.5, 48.5, 4.4, 20, JT);
  g += spout();
  // squeezed > < eyes, wobbly "ow" mouth
  g += ln('M27.5 38L37 44L27.5 50', 3.6) + ln('M54.5 38L45 44L54.5 50', 3.6);
  g += ln('M26 33L37 35.5', 3) + ln('M57 33L46 35.5', 3);
  g += shape('M32.5 56Q35.5 52.5 38.5 56Q41.5 52.5 44.5 56Q47.5 52.5 50.5 56Q52 64 41.5 65.5Q31 64 32.5 56Z', PL, null, { sw: 2.2 }) + flat('M36 62.2Q41.5 59.5 47 62.2Q45 64.4 41.5 64.4Q38 64.4 36 62.2Z', COL);
  g += shape('M50.5 60Q55 61.5 54 67Q52.4 70 50.6 67Q49.8 63.5 50.5 60Z', SKY, null, { sw: 1.9 });
  // a sweat drop each side, a bubble on the label
  g += drop(23, 40, 1, SKY) + drop(60, 38, 1, SKY) + bub(30, 73, 3.4);
  const squashed = `<g transform="translate(42.5 91) rotate(3) scale(1.04 .92) translate(-41 -91)">${g}</g>`;
  // the cap flies off, spinning
  const flying = cap('translate(-27 1) rotate(-40 41 20)');
  return grounded(pre + squashed + flying + rays([[26, 21, 31, 27], [20, 28, 26, 31]], LAV, 2.2));
}
add('enemy_spitter_a', () => spitter('a'));
add('enemy_spitter_b', () => spitter('b'));
add('enemy_spitter_tell', () => spitter('tell'));
add('enemy_spitter_hurt', () => spitter('hurt'));

function baguette(f) {
  if (!['a', 'b', 'tell', 'hurt'].includes(f)) throw new Error(`baguette: unknown frame "${f}"`);
  const W = C.white, CR = C.cream, BL = C.blue, CO = C.coral, COL = C.coralL, GO = C.gold, BR = C.bread, BRD = C.breadD, BRL = C.breadL,
    PS = C.plumSoft, LAV = C.lav, PL = C.plum;
  const ln = (d, w = 3, col = PL) => strokeD(d, col, w);
  const limbS = (d) => limb(d, BR, 5.6);
  const BODY = 'M24 18Q36 8 48 16Q56 40 53 80Q51 100 38 106Q24 104 22 84Q18 50 24 18Z';
  const BAG = 'M19 64L23 60L27 64L31 59L35 63L39 58L43 62L47 57L51 61L55 58L56 100Q42 110 22 104Z';
  // crust body, scoring cuts and the striped paper-bag shirt (no face, no limbs)
  const torso = () => flat(BODY, BR) + flat('M47 16Q56 40 53 80Q51 100 38 106Q47 96 49 78Q51 44 45 18Z', BRD) + flat('M26 26Q28 18 34 14Q29 26 27 46Z', BRL) + ln(BODY, 3) +
    shape('M26 22Q34 14 44 13L45 16Q35 18 27 26Z', CR, null, { sw: 2 }) + shape('M33 26Q41 21 50 20L50.5 23Q42 24 34 29Z', CR, null, { sw: 2 }) +
    flat(BAG, CR) + clipTo(BAG, [68, 78, 88, 98].map((y) => `<rect x="15" y="${y}" width="45" height="4" fill="${BL}"/>`).join('')) + ln(BAG, 3);
  // toothpick across the mouth
  const pick = (d, tx, ty, deg) => ln(d, 3.4) + ln(d, 1.6, GO) + `<ellipse cx="${tx}" cy="${ty}" rx="2.6" ry="1.5" transform="rotate(${deg} ${tx} ${ty})" fill="${GO}" stroke="${PL}" stroke-width="1.2"/>`;
  // game sprite anchor: nub soles must end on y = 0.95 * 120
  const grounded = (inner, dy) => `<g transform="translate(0 ${dy})">${inner}</g>`;

  if (f === 'a' || f === 'b') {
    const walk = f === 'b';
    // walk: left foot planted, right foot lifted and forward
    const legs = walk
      ? limbS('M31 103Q30 109 29 112') + nub(28, 115, -1, PS) + limbS('M43 103Q48 105 51 107') + nub(52, 110.5, 1, PS)
      : limbS('M31 103Q30 109 29 112') + limbS('M43 103Q44 109 45 112') + nub(28, 115, -1, PS) + nub(46, 115, 1, PS);
    let b = walk ? limbS('M23 66Q12 69 14 78') + mitt(15.5, 79, 4.6, 0, BR) : limbS('M23 66Q13 72 20 80') + mitt(22, 80, 4.6, 0, BR);
    b += torso();
    b += ovalEye(31, 42, 4.6, 5.5, 1.5, 0.8, { lid: 0.48, tilt: -4, lc: BR }) + ovalEye(43, 41.5, 4.6, 5.5, 1.5, 0.8, { lid: 0.48, tilt: 4, lc: BR });
    b += ln('M25 32Q30 28 35 31') + ln('M39 33L48 33.5');
    b += shape('M46 54Q38 57 30 51Q31 56 37 58Q43 58 46 54Z', PL, null, { sw: 2 }) + flat('M44 54.6Q38 56.6 32 52.5L32.4 54Q38 57.5 43 56Z', W) + ln('M29 50Q27 51 28 53', 1.5);
    b += pick('M31 52L17 46', 16, 45.5, 25);
    // flexing right arm: the bicep bulge, a fist and two shake ticks
    b += walk
      ? limb('M53 68Q63 73 65 67Q66 61 64 58', BR, 7) + `<ellipse cx="61" cy="68.5" rx="4.6" ry="3.6" fill="${BR}" stroke="${PL}" stroke-width="2"/>` + mitt(64, 54, 5, 170, BR) + ln('M69 61L71 59.5', 1.5) + ln('M70 66L71 66', 1.5)
      : limb('M53 68Q63 71 64 64Q65 58 63 55', BR, 7) + `<ellipse cx="60" cy="65.5" rx="4.6" ry="3.6" fill="${BR}" stroke="${PL}" stroke-width="2"/>` + mitt(63, 51, 5, 170, BR) + ln('M68 58L71 56', 1.5) + ln('M69 63L71 63', 1.5);
    return grounded(legs + (walk ? `<g transform="translate(0 -1.5)">${b}</g>` : b), -2.2);
  }
  if (f === 'tell') {
    // coiled for a huge haymaker: wide stance leaning back, right arm cocked far behind the head, guard fist up front
    let b = limbS('M31 103Q27 107 25 109.8') + limbS('M43 103Q47 108.5 49 112.5') + nub(24, 112.8, -1, PS) + nub(50, 115.5, 1, PS);
    b += limbS('M23 69Q15 72 16 64') + fist(16, 60, 5.2, 12, BR);
    b += torso();
    // glaring coral eyes, brows slammed down
    b += ovalEye(31, 42, 4.8, 6, 1.2, 0.6, { lid: 0.34, tilt: 15, lc: BR, sclera: CO, pr: 2.6 }) + ovalEye(43.5, 41.5, 4.8, 6, -1.2, 0.6, { lid: 0.34, tilt: -15, lc: BR, sclera: CO, pr: 2.6 });
    b += ln('M23 31L36 38', 3.6) + ln('M51 32L40 38', 3.6);
    // gritted teeth, toothpick bitten and angled up
    b += shape('M28.5 50Q38 47.5 47.5 50L47.5 59Q38 61.5 28.5 59Z', W, null, { sw: 2.4 }) + ln('M33.5 49.5L33.5 60', 1.4) + ln('M38 49L38 60.5', 1.4) + ln('M42.5 49.5L42.5 60', 1.4) + ln('M28.5 54.5Q38 55.5 47.5 54.5', 1.4);
    b += pick('M30 54L17 44', 16.5, 43.4, 37);
    // cocked haymaker arm, big fist behind the head
    b += limb('M52 68Q66 68 67 51Q68 39 63 32', BR, 7.6) + fist(63, 26, 7.6, -25, BR);
    // anger mark
    b += ln('M49 10Q53 12 52 16M52 8Q56 10 55 14', 3.6) + ln('M49 10Q53 12 52 16M52 8Q56 10 55 14', 1.6, CO);
    const body = `<g transform="translate(-3 0) rotate(-5 38 115)">${b}</g>`;
    let fx = ln('M64 9L68 5', 2.4, CO) + ln('M66 18L69.5 15', 2.4, CO) + ln('M56 7.5L58 4', 2.4, CO);
    fx += ln('M5 96L5 106', 2.6, LAV) + ln('M10 88L10 100', 2.6, LAV) + ln('M64 98L64 108', 2.6, LAV) + ln('M59 88L59 100', 2.6, LAV);
    fx += ln('M69 66Q71.5 56 69 48', 2.4, LAV);
    return grounded(body + fx, -2.2);
  }
  // hurt: bent in the middle (upper half kinked over, a wedge of crumb showing at the crack), eyes squeezed,
  // wobbly "ow" mouth, arms flung up, toothpick tumbling away, crumbs flying, stars and sweat
  let b = '';
  // dark gap where the crust cracks open (right side)
  b += shape('M26 78L56.5 78L56 71.5L38 76Z', PS, null, { sw: 2.2 });
  // lower half: legs and torso below the crack
  b += limbS('M31 103Q30 109 28 112') + limbS('M43 103Q45 109 47 112') + nub(27, 115, -1, PS) + nub(48, 115, 1, PS);
  b += clipTo('M-10 78L90 78L90 138L-10 138Z', torso());
  // upper half: torso above the crack, face and arms, all kinked together
  let u = clipTo('M-10 -10L90 -10L90 78L-10 78Z', torso());
  u = limbS('M23 66Q10 62 10 50') + mitt(10, 47, 4.6, 20, BR) + u;
  u += ln('M24 33L34 28.5') + ln('M49 34L40 29');
  u += ln('M27 37L35.5 42.5L27 48', 3.6) + ln('M48 36.5L39.5 42L48 47.5', 3.6);
  u += shape('M29 52Q33 49 38 52Q43 49 47 52Q50 60 38 62Q26 60 29 52Z', PL, null, { sw: 2 }) + flat('M32 59Q38 55.5 44 59Q42 62 38 62Q34 62 32 59Z', COL);
  u += limbS('M53 66Q64 62 63 50') + mitt(63, 47, 4.6, -20, BR);
  b += `<g transform="translate(0 -2) rotate(-14 38 78)">${u}</g>`;
  // crack line over the kink
  b += ln('M22 82L30 79.5L34 81L38 78', 2.2);
  // fx: tumbling toothpick, crumbs, stars, sweat
  let fx = `<g transform="translate(14 74) rotate(-62)">${ln('M-8 0L8 0', 3.4)}${ln('M-8 0L8 0', 1.6, GO)}<ellipse cx="9" cy="0" rx="2.6" ry="1.5" fill="${GO}" stroke="${PL}" stroke-width="1.2"/></g>` + ln('M5 62L8 66', 1.8, LAV) + ln('M3 72L7 74', 1.8, LAV);
  const crumb = (x, y, k, fill, deg = 0) => `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${k})">${shape('M-3 -1L0 -3L3.2 -1L2.4 2.2L-1.6 2.6Z', fill, null, { sw: 1.6 })}</g>`;
  fx += crumb(62, 20, 1.2, BRL) + crumb(67, 36, 1, BR, 40) + crumb(4, 28, 1.1, BR, 20) + crumb(58, 72, 1.3, BRL, 70) + crumb(66, 62, 0.9, CR, 10) + crumb(10, 90, 1, BRL, 50) + crumb(60, 94, 0.9, BR, 30) + crumb(5, 46, 0.8, CR);
  fx += `<circle cx="56" cy="62" r="1.3" fill="${BRD}"/><circle cx="68" cy="52" r="1.2" fill="${BRL}"/><circle cx="8" cy="38" r="1.2" fill="${BRD}"/><circle cx="55" cy="84" r="1.2" fill="${BRL}"/>`;
  fx += shape(star(10, 12, 5, 2.2, 5), GO, null, { sw: 1.6 }) + shape(star(52, 9, 4.5, 2, 5), GO, null, { sw: 1.6 });
  fx += drop(60, 10, 0.9) + drop(5, 52, 0.9);
  return grounded(`<g transform="translate(6 0)">${b}</g>` + fx, -2.2);
}
add('enemy_baguette_a', () => baguette('a'));
add('enemy_baguette_b', () => baguette('b'));
add('enemy_baguette_tell', () => baguette('tell'));
add('enemy_baguette_hurt', () => baguette('hurt'));


// ---------- egg carton (exploder) ----------
function egg(f) {
  if (!['a', 'b', 'tell', 'hurt'].includes(f)) throw new Error(`egg: unknown frame "${f}"`);
  const W = C.white, CR = C.cream, CRD = C.creamD, LAV = C.lav, CO = C.coral, COD = C.coralD, COL = C.coralL, GO = C.gold,
    BRD = C.breadD, BRL = C.breadL, BAL = C.bananaL, PL = C.plum;
  const ln = (d, w = 3, col = PL) => strokeD(d, col, w);
  const limbS = (d) => limb(d, CRD, 5.6);
  const eggPath = (x, y, rx, ry) => {
    const t = y - ry, bt = y + ry, r = x + rx, l = x - rx;
    return `M${n(x)} ${n(t)}C${n(x + rx * 0.75)} ${n(t)} ${n(r)} ${n(y - ry * 0.1)} ${n(r)} ${n(y + ry * 0.25)}C${n(r)} ${n(y + ry * 0.8)} ${n(x + rx * 0.5)} ${n(bt)} ${n(x)} ${n(bt)}` +
      `C${n(x - rx * 0.5)} ${n(bt)} ${n(l)} ${n(y + ry * 0.8)} ${n(l)} ${n(y + ry * 0.25)}C${n(l)} ${n(y - ry * 0.1)} ${n(x - rx * 0.75)} ${n(t)} ${n(x)} ${n(t)}Z`;
  };
  // plain dot eyes: they have to read at ~13px
  const pupil = (cx, cy, r) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" fill="${PL}"/><circle cx="${n(cx - r * 0.3)}" cy="${n(cy - r * 0.35)}" r="${n(r * 0.36)}" fill="${W}"/>`;
  // one scared egg. mood: worry | scream | shut
  const eggie = (x, y, rx, ry, mood) => {
    const ex = rx * 0.4, ey = y - ry * 0.1, my = y + ry * 0.5;
    let s = shape(eggPath(x, y, rx, ry), W, null, { sw: 2.4 });
    s += flat(`M${n(x + rx * 0.55)} ${n(y - ry * 0.45)}Q${n(x + rx * 0.98)} ${n(y + ry * 0.1)} ${n(x + rx * 0.5)} ${n(y + ry * 0.75)}Q${n(x + rx * 0.78)} ${n(y + ry * 0.1)} ${n(x + rx * 0.55)} ${n(y - ry * 0.45)}Z`, CRD);
    if (mood === 'shut') {
      s += ln(`M${n(x - ex - 2.4)} ${n(ey - 2.2)}L${n(x - ex + 1.4)} ${n(ey)}L${n(x - ex - 2.4)} ${n(ey + 2.2)}`, 1.9) + ln(`M${n(x + ex + 2.4)} ${n(ey - 2.2)}L${n(x + ex - 1.4)} ${n(ey)}L${n(x + ex + 2.4)} ${n(ey + 2.2)}`, 1.9);
      s += ln(`M${n(x - 3)} ${n(my)}Q${n(x - 1.5)} ${n(y + ry * 0.35)} ${n(x)} ${n(my)}Q${n(x + 1.5)} ${n(y + ry * 0.65)} ${n(x + 3)} ${n(my)}`, 1.7);
    } else if (mood === 'scream') {
      s += pupil(x - ex, ey, 2.9) + pupil(x + ex, ey, 2.9);
      s += `<ellipse cx="${n(x)}" cy="${n(my)}" rx="3" ry="3.8" fill="${PL}"/>` + flat(`M${n(x - 1.8)} ${n(my + 2.8)}Q${n(x)} ${n(my)} ${n(x + 1.8)} ${n(my + 2.8)}Q${n(x)} ${n(my + 4)} ${n(x - 1.8)} ${n(my + 2.8)}Z`, COL);
    } else {
      s += pupil(x - ex, ey, 2.4) + pupil(x + ex, ey, 2.4);
      s += `<ellipse cx="${n(x)}" cy="${n(my)}" rx="1.8" ry="2.3" fill="${PL}"/>`;
    }
    return s;
  };
  // lid, three eggs, carton front. mood moves the eggs' faces; hurt cracks the left one.
  const carton = (mood, hurt = false) => {
    let b = shape('M8 38L11 17L58 11L68 38Z', CRD, null) + flat('M15 36L17.5 22L54 17.5L62 36Z', CR);
    b += ln('M18 30L52 26', 1.6, BRL);
    const m = hurt ? 'shut' : mood;
    b += eggie(55, 28, 8.6, 10.5, m) + eggie(21, 28, 8.6, 10.5, m) + eggie(38, 24.5, 8.8, 11, m);
    if (hurt) {
      // cracked left egg with yolk
      b += ln('M19 20L23 24L24 18L28 23', 2.2) + shape('M12 24Q11 15.5 18 17Q23 15.5 23.5 22.5Q23 28 17.5 27.5Q13 28.5 12 24Z', GO, null, { sw: 2 }) + flat('M14.5 21Q15.5 18.8 18.5 19.3', BAL, 'stroke="none"');
    }
    b += shape('M7 34.5L69 34.5L67 42L9 42Z', CR, null, { sw: 2.6 });
    b += shape('M11 40.5L65 40.5L63 76Q63 78.5 60 78.5L16 78.5Q13 78.5 13 76Z', CRD, null);
    b += `<path d="M53 42L64 42L62.4 76Q62.4 77.6 60 77.6L50 77.6Q55 60 53 42Z" fill="${BRL}" fill-opacity=".5"/>` + flat('M15 44L21 44L19.5 70L15.5 70Z', CR);
    // egg-cup bumps along the bottom
    b += ln('M16 76Q21 71.5 26 76', 1.5, BRD) + ln('M50 76Q55 71.5 60 76', 1.5, BRD);
    return b;
  };
  // game sprite anchor: nub soles must end on y = 0.95 * 90
  const grounded = (inner) => `<g transform="translate(0 -1.7)">${inner}</g>`;

  if (f === 'a' || f === 'b') {
    const walk = f === 'b';
    // walk: left foot planted, right foot lifted and forward
    const legs = walk
      ? limbS('M28 76L27 82') + nub(25, 86, -1, LAV) + limbS('M48 76Q51 78 52 80') + nub(53, 83, 1, LAV)
      : limbS('M28 76L27 82') + limbS('M48 76L49 82') + nub(25, 86, -1, LAV) + nub(50, 86, 1, LAV);
    let b = walk
      ? limbS('M12 60Q6.5 64 8 59') + mitt(8.2, 55.5, 4.8, 0, CRD) + limbS('M64 60Q70 59 69 51') + mitt(68.8, 47.5, 4.8, 0, CRD)
      : limbS('M12 60Q6.5 63 8.5 56') + mitt(8.7, 52.5, 4.8, 0, CRD) + limbS('M64 60Q69.5 63 67.5 56') + mitt(67.3, 52.5, 4.8, 0, CRD);
    b += carton('worry');
    b += ovalEye(28, 55, 6.4, 7.8, -1.6, 0.8, { pr: 2.7 }) + ovalEye(48, 55, 6.4, 7.8, -1.6, 0.8, { pr: 2.7 });
    b += ln('M19.5 48L33 43.5') + ln('M56.5 48L43 43.5');
    b += shape('M30 68Q33 65 36 68Q39 71 42 68Q45 65 47 68Q46 75 38.5 75Q31 75 30 68Z', PL, null, { sw: 2 }) + flat('M33.5 72.5Q38.5 70 43.5 72.5Q38.5 75.5 33.5 72.5Z', COL);
    b += drop(66, 38, 1.15) + drop(10, 46, 1);
    b += ln('M2.8 50L4.6 47.5', 1.8, LAV) + ln('M73.2 50L71.4 47.5', 1.8, LAV) + ln('M2.8 58L4.6 60', 1.8, LAV) + ln('M73.2 58L71.4 60', 1.8, LAV);
    return grounded(legs + (walk ? `<g transform="translate(0 -1.5)">${b}</g>` : b));
  }
  if (f === 'tell') {
    // lit fuse out of a crack in the lid
    let b = strokeD('M54 11.5L57.5 15L54.5 18.5L58 22', CO, 5);
    b += limbS('M28 76L26 82') + limbS('M48 76L50 82') + nub(24, 86, -1, LAV) + nub(51, 86, 1, LAV);
    b += `<g transform="translate(38 80) scale(1.06 1.04) translate(-38 -80)">`;
    b += limbS('M12 58Q6.5 55 10.5 41') + mitt(11, 37.5, 4.6, -12, CRD) + limbS('M64 58Q69.5 55 65.5 41') + mitt(65, 37.5, 4.6, 12, CRD);
    b += carton('scream');
    b += strokeD('M54 11.5L57.5 15L54.5 18.5L58 22', PL, 2.2);
    b += ovalEye(27.5, 55, 7.2, 8.8, 0, 0, { pr: 2, sclera: COL }) + ovalEye(48.5, 55, 7.2, 8.8, 0, 0, { pr: 2, sclera: COL });
    b += ln('M18 48.5L33 42.5', 3.4) + ln('M58 48.5L43 42.5', 3.4);
    b += shape('M30 66.5Q38 63.5 46 66.5Q47.5 77 38 77Q28.5 77 30 66.5Z', PL, null, { sw: 2 }) + flat('M33 75Q38 69.5 43 75Q38 78 33 75Z', COL);
    b += `</g>`;
    // fuse cord and spark (dropped 1.5 so the spark stays inside the canvas after the ground shift)
    const cord = 'M55 12Q57.5 8 62 11Q66.5 14 64.5 10';
    b += ln(cord, 4.6) + ln(cord, 2.2, BRL);
    b += shape(star(64.5, 10, 7, 3, 6), GO, null, { sw: 2 }) + flat(star(64.5, 10, 3.6, 1.5, 6), CO) + ln('M70.5 6.5L73.5 5', 1.8, COD) + ln('M71.5 12.5L74.5 13.5', 1.8, COD) + ln('M58 6L55.5 4.5', 1.8, COD);
    b += ln('M4.5 52Q2.5 60 4.5 68', 2.6, LAV) + ln('M71.5 52Q73.5 60 71.5 68', 2.6, LAV) + ln('M7 74L4 78', 2.4, LAV) + ln('M69 74L72 78', 2.4, LAV);
    b += drop(14, 12, 1.1) + drop(62, 32, 1.05);
    return grounded(b);
  }
  // hurt
  let b = shape(star(12, 14, 5.5, 2.4, 5), GO, null, { sw: 1.6 }) + shape(star(68, 10, 4.6, 2, 5), GO, null, { sw: 1.6 });
  b += limbS('M28 76L27 82') + limbS('M48 76L50 82') + nub(25, 86, -1, LAV) + nub(51, 86, 1, LAV);
  b += `<g transform="translate(2.5 0) rotate(-7 38 82) translate(38 80) scale(1.04 .94) translate(-38 -80)">`;
  b += limbS('M12 60Q6 66 9 72') + mitt(9.5, 74, 4.4, 0, CRD) + limbS('M64 60Q73 54 69 47') + mitt(69, 44, 4.4, 20, CRD);
  b += carton('shut', true);
  // yolk drip down the front
  b += shape('M13.5 40Q12 47 13 53Q13.5 58 17 58Q20.5 58 19.5 53Q19.5 47 20.5 41Z', GO, null, { sw: 2 }) + flat('M15 44Q14.5 49 15.5 53', BAL, 'stroke="none"');
  b += ln('M20 57L33 52', 3.2) + ln('M56 57L43 52', 3.2);
  b += ln('M22 49L33.5 55.5L22 62', 3.4) + ln('M54 49L42.5 55.5L54 62', 3.4);
  b += shape('M29.5 68Q32.5 63.5 35.5 67.5Q38 63.5 40.5 67.5Q43.5 63.5 46.5 68Q47 76.5 38 76.5Q29 76.5 29.5 68Z', PL, null, { sw: 2 }) + flat('M32.5 74Q38 71 43.5 74Q38 77.5 32.5 74Z', COL);
  b += `</g>`;
  b += drop(63, 30, 1.2) + drop(8, 36, 1.1);
  b += ln('M3 30L6 32', 1.8, LAV) + ln('M73 24L70 27', 1.8, LAV);
  return grounded(b);
}
add('enemy_egg_a', () => egg('a'));
add('enemy_egg_b', () => egg('b'));
add('enemy_egg_tell', () => egg('tell'));
add('enemy_egg_hurt', () => egg('hurt'));

// ---------- watermelon (splitter) + slice ----------
function melon(f) {
  if (f !== 'a' && f !== 'b' && f !== 'hurt') throw new Error(`melon: unknown frame "${f}"`);
  const hurt = f === 'hurt', walkB = f === 'b';
  const W = C.white, G = C.green, GD = C.greenD, CO = C.coral, COD = C.coralD, COL = C.coralL;
  const BODY = 'M40 15Q63 15 70 42Q75 68 58 82Q40 89 22 82Q5 68 10 42Q17 15 40 15Z';
  const stripe = (k) => `M${n(40 + k * 8)} 11Q${n(40 + k * 62)} 50 ${n(40 + k * 8)} 92`;
  // rind body with stripes, shade, highlight, outline
  const rindBody = () => {
    const id = `c${++uid}`, id2 = `c${++uid}`;
    let s = `<clipPath id="${id}"><path d="${BODY}"/></clipPath><clipPath id="${id2}"><rect x="0" y="67" width="80" height="30"/></clipPath>`;
    s += flat(BODY, G);
    s += `<g clip-path="url(#${id})">`;
    for (const k of [-0.82, 0.82]) s += strokeD(stripe(k), GD, 4.6);
    s += `<g clip-path="url(#${id2})">` + [-0.5, 0.5].map((k) => strokeD(stripe(k), GD, 4.2)).join('') + '</g>';
    s += flat('M64 38Q76 66 58 83Q40 91 22 84Q46 82 56 70Q63 58 64 38Z', GD, 'opacity=".4"');
    s += flat('M17 36Q19 25 29 19Q23 28 22 42Z', C.greenL);
    return s + '</g>' + strokeD(BODY, C.plum, 3);
  };
  // two lenses pushed up on the forehead; t moves the whole pair (hurt: flying away)
  const shades = (t = '') => {
    const lens = (cx) => `<ellipse cx="${cx}" cy="25.5" rx="8" ry="5.2" fill="${C.blue}" stroke="${C.plum}" stroke-width="2.2"/><path d="M${cx - 5} 24.5L${cx - 1.5} 23" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/>`;
    return `<g${t ? ` transform="${t}"` : ''}>` + strokeD('M22.5 25.5L16 28', C.plum, 2.2) + strokeD('M57.5 25.5L64 28', C.plum, 2.2) + strokeD('M37 25Q40 23 43 25', C.plum, 2.6) + lens(30) + lens(50) + '</g>';
  };
  // the nubs are drawn with their bottom edge on y = 95; raise everything 1.2 so the outline's outer edge rests on the 0.95 x 100 ground line
  const lift = (inner) => `<g transform="translate(0 -1.2)">${inner}</g>`;
  const stem = () => shape('M36.5 16.5Q37 8 42 6.5Q41.5 12 43.5 16.5Z', GD, null, { sw: 2.2 }) + strokeD('M42 8Q47 4 51 7Q53 10 50 11', C.plum, 1.8);
  let b = '';
  if (hurt) {
    // hurt: squashed + leaning, arms up, crack across the belly
    b += limb('M30 84L28 90', G, 5.6) + limb('M50 84L52 90', G, 5.6) + nub(26, 95, -1, CO) + nub(54, 95, 1, CO);
    let body = stem() + rindBody();
    // zigzag crack: flesh inside, white pith edge, plum seeds
    const top = [[8, 67], [18, 73], [26, 67], [35, 74], [44, 67], [53, 74], [61, 67], [72, 72]];
    const bot = [[72, 81], [61, 77], [53, 85], [44, 78], [35, 86], [26, 78], [18, 85], [8, 78]];
    const crack = 'M' + top.concat(bot).map((p) => p.join(' ')).join('L') + 'Z';
    body += clipTo(BODY, flat(crack, CO) + strokeD('M8 69L18 75L26 69L35 76L44 69L53 76L61 69L72 74', W, 3) + strokeD('M72 80L61 76L53 84L44 77L35 85L26 77L18 84L8 77', COD, 2.4) +
      `<path d="${crack}" fill="none" stroke="${C.plum}" stroke-width="2.6" stroke-linejoin="round"/>`);
    body += melonSeed(22, 80, 25, 1) + melonSeed(36, 81, -25, 1.1) + melonSeed(50, 81, 20, 1.1) + melonSeed(64, 78, -20, 1);
    body += strokeD('M13 62L18 70', C.plum, 2.4) + strokeD('M66 60L61 69', C.plum, 2.4);
    // face: > < eyes, wobbly ow mouth
    body += strokeD('M22 42L34 48L22 54', C.plum, 3.8) + strokeD('M58 42L46 48L58 54', C.plum, 3.8);
    body += strokeD('M21 38L31 33', C.plum, 2.8) + strokeD('M59 38L49 33', C.plum, 2.8);
    body += shape('M34 56Q36 53 38.5 55Q40.5 52.5 42.5 55Q45 53 47 56Q49 60 46.5 65Q44 69 40.5 67Q37 69 34.5 65Q32 60 34 56Z', C.plum, null, { sw: 2.2 }) + flat('M36.5 64.5Q40.5 60 44.5 64.5Q40.5 68 36.5 64.5Z', COL);
    body += `<path d="M18 49Q12 50 11 56Q16 57 18 52Z" fill="${C.sky}" stroke="${C.plum}" stroke-width="1.6"/><path d="M62 49Q68 50 69 56Q64 57 62 52Z" fill="${C.sky}" stroke="${C.plum}" stroke-width="1.6"/>`;
    body += `<ellipse cx="19" cy="57" rx="4" ry="2.8" fill="${COL}" opacity=".6"/><ellipse cx="61" cy="57" rx="4" ry="2.8" fill="${COL}" opacity=".6"/>`;
    body += limb('M14 52Q8 46 11 34', G, 5.6) + mitt(11, 31, 4.6, -10, G) + limb('M66 52Q72 46 69 34', G, 5.6) + mitt(69, 31, 4.6, 10, G);
    b += `<g transform="translate(2.6 0) rotate(-4 40 95) translate(40 95) scale(1.04 .94) translate(-40 -95)">${body}</g>`;
    // knocked-off shades + sweat + impact stars
    b += shades('translate(-15 -3) rotate(-26 40 25)');
    b += strokeD('M6 20L12 24', C.lav, 2.2) + strokeD('M22 9L26 15', C.lav, 2.2);
    b += drop(63, 12, 1.1) + drop(72, 60, 1) + shape(star(70, 22, 4.5, 2, 5), C.gold, null, { sw: 1.6 });
    return lift(b);
  }
  // idle (a) and its walk partner (b): other foot lifted, arms swapped, body bobbed up 1.5
  if (walkB) b += limb('M31 83L30 90', G, 5.6) + nub(28, 95, -1, CO) + limb('M49 83L51 87', G, 5.6) + nub(53, 91.5, 1, CO);
  else b += limb('M31 83L30 90', G, 5.6) + limb('M49 83L50 90', G, 5.6) + nub(28, 95, -1, CO) + nub(52, 95, 1, CO);
  let up = walkB ? limb('M68 50Q79 58 74 66Q72 70 67 70', G, 5.6) + mitt(66, 70, 4.4, 18, G) : limb('M12 50Q1 58 6 66Q8 70 13 70', G, 5.6) + mitt(14, 70, 4.4, 100, G);
  up += stem() + rindBody();
  up += ovalEye(29, 47, 5.6, 6.6, 0.8, 0.6, { lid: 0.3, tilt: -4, lc: G }) + ovalEye(51, 47, 5.6, 6.6, -0.8, 0.6, { lid: 0.3, tilt: 4, lc: G });
  up += strokeD('M22 38Q28 34 35 37', C.plum, 2.8) + strokeD('M45 37Q52 34 58 38', C.plum, 2.8);
  up += `<ellipse cx="19" cy="58" rx="4" ry="2.8" fill="${COL}" opacity=".6"/><ellipse cx="61" cy="58" rx="4" ry="2.8" fill="${COL}" opacity=".6"/>`;
  up += shape('M27 57Q40 54 53 57Q52 71 40 71Q28 71 27 57Z', C.plum, null, { sw: 2.4 }) + flat('M29.5 58Q40 56 50.5 58L50 62.5Q40 60.5 30 62.5Z', W) + flat('M33 69.5Q40 63.5 47 69.5Q40 72.5 33 69.5Z', COL);
  up += shades();
  up += walkB ? limb('M13 50Q6 46 8 38', G, 5.6) + mitt(8, 34, 4.6, 133, G) : limb('M67 50Q74 46 72 38', G, 5.6) + mitt(72, 34, 4.6, -15, G);
  return lift(b + (walkB ? `<g transform="translate(0 -1.5)">${up}</g>` : up));
}
add('enemy_melon_a', () => melon('a'));
add('enemy_melon_b', () => melon('b'));
add('enemy_melon_hurt', () => melon('hurt'));

// ---------- frozen turkey (tank): frozen gym-bro popsicle ----------
function turkey(f) {
  if (f !== 'a' && f !== 'b' && f !== 'tell' && f !== 'hurt') throw new Error(`turkey: unknown frame "${f}"`);
  const walkB = f === 'b';
  const W = C.white, CR = C.cream, CRD = C.creamD, FR = C.frost, FRD = C.frostD, COL = C.coralL, TE = C.teal, TED = C.tealD, LAV = C.lav, SKY = C.sky, BRL = C.breadL;
  const limbT = (d) => limb(d, FR, 8.5);
  const BODY = 'M60 11C80 11 93 26 96.5 46C99.5 64 84 77.5 60 77.5C36 77.5 20.5 64 23.5 46C27 26 40 11 60 11Z';
  // same body with a chunk knocked out of the right shoulder
  const BODY_CHIP = 'M60 11C80 11 93 26 95 37L87 40L93.5 45L86 49.5L97 54C98 66 84 77.5 60 77.5C36 77.5 20.5 64 23.5 46C27 26 40 11 60 11Z';
  // drumstick forearm: origin = elbow, meaty end up
  const drumstick = (x, y, deg, k = 1) => {
    let s = `<g transform="translate(${n(x)} ${n(y)}) rotate(${deg}) scale(${k})">`;
    s += shape('M-2.4 3L-2.4 -10L2.4 -10L2.4 3Z', W, null, { sw: 2 }) + dot(-2.7, 3.3, 2.8, W, 2) + dot(2.7, 3.3, 2.8, W, 2);
    s += shape('M0 -35C10.5 -35 12.5 -26.5 10 -20C7.5 -14 3 -10.5 0 -10.5C-3 -10.5 -7.5 -14 -10 -20C-12.5 -26.5 -10.5 -35 0 -35Z', CRD, null, { sw: 2.8 });
    s += flat('M3.5 -32.5C9.4 -30.5 10.5 -25 8.4 -20C7 -16.5 5 -14.8 2.6 -14C6.4 -19 7 -27 3.5 -32.5Z', BRL);
    s += flat('M-7.5 -29.5C-6 -32.5 -3 -33.8 0.5 -33.8C-3.5 -31.3 -5.6 -26.5 -6 -21.5C-8.8 -23.5 -9 -26.5 -7.5 -29.5Z', CR);
    s += shape('M-6.5 -32.5Q-3.5 -36.5 0 -35.5Q3.5 -37 5.5 -33Q1 -31.5 -2.2 -32.8Q-4.5 -29.8 -6.5 -32.5Z', W, null, { sw: 1.6 });
    return s + '</g>';
  };
  // bicep bump on the upper arm
  const bicep = (x, y) => dot(x, y, 7, FR, 2.6) + flat(`M${n(x + 2.5)} ${n(y - 4.5)}Q${n(x + 6)} ${n(y)} ${n(x + 2.5)} ${n(y + 4.5)}Q${n(x + 4.5)} ${n(y)} ${n(x + 2.5)} ${n(y - 4.5)}Z`, FRD) +
    strokeD(`M${n(x - 4)} ${n(y - 2.5)}Q${n(x - 2.5)} ${n(y - 4.2)} ${n(x - 0.5)} ${n(y - 4.2)}`, W, 1.5);
  // frosted torso: body, shade, shine, rime cap and sweatband (clipped to the body), then outline
  const torso = (path = BODY) => {
    const id = `c${++uid}`;
    let s = `<clipPath id="${id}"><path d="${path}"/></clipPath>` + flat(path, FR);
    s += `<g clip-path="url(#${id})">` + flat('M112 14L112 90L36 90C80 86 100 60 84 14Z', FRD);
    // rime cap with a scalloped lower edge
    const sc = 'M10 22Q16 27 22 22Q28 27 34 22Q40 27 46 22Q52 27 58 22Q64 27 70 22Q76 27 82 22Q88 27 94 22Q100 27 106 22L110 22';
    s += flat('M10 -4L110 -4L110 22L10 22Z', W) + flat(sc + 'Z', W) + strokeD(sc, C.plum, 2.4);
    // sweatband
    s += flat('M10 25Q60 36 110 25L110 33Q60 44 10 33Z', TE) + flat('M10 29Q60 40 110 29L110 33Q60 44 10 33Z', TED) + strokeD('M10 25Q60 36 110 25M10 33Q60 44 110 33', C.plum, 2.6);
    s += `</g>` + flat('M29 44Q30 34 38 28Q34 36 34 48Z', W);
    s += strokeD(path, C.plum, 3);
    // flakes on the belly
    s += strokeD('M30 62l5 0M32.5 59.5l0 5M31 60.5l3 3M34 60.5l-3 3', FRD, 1.4) + strokeD('M88 60l5 0M90.5 57.5l0 5M89 58.5l3 3M92 58.5l-3 3', W, 1.4);
    // ice cubes on the band
    const cube = (cx, cy, k, deg) => `<g transform="translate(${cx} ${cy}) rotate(${deg}) scale(${k})">` + shape('M-6.5 -5.5L5.5 -6.5L6.5 5L-5.5 6.5Z', W, null, { sw: 2.2 }) + flat('M-4 -3.5L2 -4.2L1.4 -2L-3.6 -1.4Z', FRD) + strokeD('M-3.5 3.2L-1 3', FRD, 1.4) + `</g>`;
    return s + cube(42, 35.5, 1.15, -8) + cube(79, 37.5, 0.95, 10);
  };
  const icicles = () => [34, 60, 86].map((x, i) => shape(`M${x - 3.5} 73L${n(x + 0.5 * (i - 1))} ${i === 1 ? 86 : 83}L${x + 3.5} 73Z`, W, null, { sw: 2 })).join('');
  // the sole's outline edge rests on the sprite's ground line (0.95 x 96 = 91.2); lift raises the right foot in the walk partner
  const FY = 87.55;
  const legs = (lift = 0) => limbT('M46 75L46 82.5') + limbT(`M74 75L74 ${n(82.5 - lift)}`) + sneaker(46, FY, -1, LAV, 0.85) + sneaker(74, n(FY - lift), 1, LAV, 0.85);
  // flexing arm: shoulder fixed, y = how far the drumstick is raised (negative lowers it), deg = drumstick tilt
  const armL = (y, deg) => limbT(`M26 58Q18 ${n(61 - y * 0.6)} 12 ${n(54 - y)}`) + bicep(19.5, 58.5 - y * 0.5) + drumstick(12, 54 - y, deg);
  const armR = (y, deg) => limbT(`M94 58Q102 ${n(61 - y * 0.6)} 108 ${n(54 - y)}`) + bicep(100.5, 58.5 - y * 0.5) + drumstick(108, 54 - y, deg);
  let b = '';

  if (f === 'a' || walkB) {
    // b: right foot lifted, left arm pumped up and right arm down, body bobbed up 1.5
    const bob = (inner) => (walkB ? `<g transform="translate(0 -1.5)">${inner}</g>` : inner);
    b += bob(icicles()) + legs(walkB ? 4.5 : 0);
    let up = torso();
    // flexing arms: bicep on the upper arm, drumstick forearm up
    up += walkB ? armL(3.5, 3) + armR(-3.5, -13) : armL(0, 8) + armR(0, -8);
    // face: cocky half-lids, clenched chattering teeth
    up += ovalEye(47, 50.5, 7.2, 8.2, 0.8, 0.6, { pr: 3.1, lid: 0.32, tilt: 9, lc: FR }) + ovalEye(73, 50.5, 7.2, 8.2, -0.8, 0.6, { pr: 3.1, lid: 0.32, tilt: -9, lc: FR });
    up += strokeD('M36.5 42L55.5 46', C.plum, 4.2) + strokeD('M83.5 42L64.5 46', C.plum, 4.2);
    up += shape('M46 60Q60 56.5 74 60L73.5 69Q60 75 46.5 69Z', W, null, { sw: 2.4 });
    for (const x of [51, 56, 60, 64, 69]) up += strokeD(`M${x} 58.8L${x} 71`, C.plum, 1.4);
    up += strokeD('M46.5 64.5Q60 67.5 73.5 64.5', C.plum, 1.5);
    up += shape('M50 72Q60 78 70 72Q60 74.4 50 72Z', COL, null, { sw: 1.8 });
    up += strokeD('M42 63Q39.5 60.5 42 58', FRD, 1.6) + strokeD('M78 63Q80.5 60.5 78 58', FRD, 1.6);
    up += drop(98, 22, 1.1, SKY);
    return b + bob(up);
  }

  if (f === 'tell') {
    b += legs();
    b += squash(60, 77, 1.07, 1.1, icicles() + torso() +
      ovalEye(47, 50.5, 7.6, 8.8, 0, 1, { pr: 3, lid: 0.46, tilt: 15, lc: FR, sclera: COL }) + ovalEye(73, 50.5, 7.6, 8.8, 0, 1, { pr: 3, lid: 0.46, tilt: -15, lc: FR, sclera: COL }) +
      strokeD('M35 38.5L56.5 46', C.plum, 4.6) + strokeD('M85 38.5L63.5 46', C.plum, 4.6) +
      // roaring mouth
      shape('M44 58.5Q60 54 76 58.5Q78.5 75 60 76Q41.5 75 44 58.5Z', C.plum, null, { sw: 2.6 }) + shape('M47 60Q60 57 73 60L72 64.5Q60 62 48 64.5Z', W, null, { sw: 1.8 }) + flat('M50 72.5Q60 65 70 72.5Q60 76.5 50 72.5Z', COL));
    // arms flexed high and flared
    b += limbT('M27 58Q21.5 58 22.5 49') + bicep(25.5, 59) + drumstick(22.5, 49, -14, 1.05) + limbT('M93 58Q98.5 58 97.5 49') + bicep(94.5, 59) + drumstick(97.5, 49, 14, 1.05);
    // frost breath
    b += dot(86, 68, 6.5, W, 2.4) + dot(95, 73, 8, W, 2.4) + dot(104, 67.5, 6.5, W, 2.4) + dot(108.5, 74.5, 5.5, W, 2.4) + dot(102, 79, 5.5, W, 2.4);
    b += strokeD('M83.5 66.5Q85 64.5 88 65.5', FRD, 1.5) + strokeD('M92.5 72Q95.5 69.5 99 72', FRD, 1.6) + strokeD('M101 66Q104 64.5 107 66', FRD, 1.5);
    b += strokeD('M113 61L116.5 58.5', LAV, 2.2) + strokeD('M115 69L118 69', LAV, 2.2) + strokeD('M112 83L115.5 85.5', LAV, 2.2);
    // shake lines
    b += strokeD('M6 60Q3.5 68 6 76', LAV, 2.6) + strokeD('M113 36Q115.5 42 113 48', LAV, 2.6);
    return b;
  }

  // hurt: flying ice chunk, chipped shoulder, squashed and leaning, arms trembling
  b += shape('M97 10L104 2L111 7L109 16L101 18Z', W, null, { sw: 2.2 }) + flat('M104 2L111 7L109 16L105 10Z', FRD) + strokeD('M98 13L103 9', FRD, 1.4);
  b += strokeD('M91 22L95 19', LAV, 2) + strokeD('M90 15L95 15', LAV, 2);
  b += shape(star(113, 26, 4, 1.8, 4), W, null, { sw: 1.6 });
  b += icicles() + legs();
  b += rot(squash(60, 77, 1.06, 0.93, torso(BODY_CHIP) +
    strokeD('M37 47.5L54 54L37 60.5', C.plum, 4) + strokeD('M83 47.5L66 54L83 60.5', C.plum, 4) +
    shape('M45 64L49 60L53 64L57 60L61 64L65 60L69 64L73 60L75 64Q74 74 60 74Q46 74 45 64Z', W, null, { sw: 2.4 }) + strokeD('M47 67L51 70L55 67L59 70L63 67L67 70L71 67L74 69', C.plum, 1.5)), -5, 60, 77);
  // arms hang and tremble
  b += limbT('M26 58Q17 61 15 65') + drumstick(15, 65, 168, 0.72) + limbT('M94 58Q103 61 105 65') + drumstick(105, 65, -168, 0.72);
  b += strokeD('M6.5 36l-3 3 3 3 -3 3', LAV, 2.2) + strokeD('M113.5 40l3 3 -3 3 3 3', LAV, 2.2);
  b += drop(24, 14, 1.15, SKY) + drop(9, 18, 1, SKY);
  return b;
}
add('enemy_turkey_a', () => turkey('a'));
add('enemy_turkey_b', () => turkey('b'));
add('enemy_turkey_tell', () => turkey('tell'));
add('enemy_turkey_hurt', () => turkey('hurt'));

// ---------- melon slice (fast, fragile): sugar-rush kid, same fruit family as the melon ----------
// Half-moon slice (flat cut on top, rind below): the widest region is the red flesh, so the face gets the whole width.
function slice(f) {
  if (f !== 'a' && f !== 'b' && f !== 'hurt') throw new Error(`slice: unknown frame "${f}"`);
  const hurt = f === 'hurt', walkB = f === 'b';
  const W = C.white, G = C.green, GD = C.greenD, CO = C.coral, COD = C.coralD, TE = C.teal;
  const BODY = 'M68 7H8A30 46 0 0 0 68 7Z';
  const PITH = 'M62.5 7H13.5A24.5 40.5 0 0 0 62.5 7Z';
  const FLESH = 'M60 7H16A22 38 0 0 0 60 7Z';
  const at = (t, rx, ry) => [n(38 + rx * Math.cos((t * Math.PI) / 180)), n(7 + ry * Math.sin((t * Math.PI) / 180))];
  // slice shape: rind + pith + flesh + rind ticks + outline. bite = circles [cx, cy, r] cut out of the body
  const sliceBody = (bite = []) => {
    const id = `c${++uid}`;
    let s = `<clipPath id="${id}"><path d="${BODY}"/></clipPath>`;
    let inner = flat(BODY, G) + flat(PITH, W) + flat(FLESH, CO);
    inner += `<g clip-path="url(#${id})">`;
    for (const t of [20, 46, 72, 108, 134, 160]) {
      const [x, y] = at(t, 32, 48), [x2, y2] = at(t, 25.5, 41.5);
      inner += `<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${GD}" stroke-width="4"/>`;
    }
    inner += flat('M58 14Q58 34 45 43Q38 45 30 43Q48 42 52 28Q54 20 54 14Z', COD, 'opacity=".55"');
    inner += '</g>' + strokeD(BODY, C.plum, 3);
    if (!bite.length) return s + inner;
    // bite: one evenodd clip per circle (frame minus that circle), nested so the cuts intersect and overlaps stay empty
    const cuts = bite.map(([x, y, r]) => ({ id: `c${++uid}`, x, y, r }));
    const frame = 'M-10 -10H90V80H-10Z';
    for (const c of cuts) s += `<clipPath id="${c.id}"><path d="${frame}M${c.x - c.r} ${c.y}a${c.r} ${c.r} 0 1 0 ${2 * c.r} 0a${c.r} ${c.r} 0 1 0 ${-2 * c.r} 0Z" clip-rule="evenodd"/></clipPath>`;
    const nest = (list, body) => list.reduceRight((acc, c) => `<g clip-path="url(#${c.id})">${acc}</g>`, body);
    s += nest(cuts, inner);
    // re-stroke each bite arc, hidden where another circle already removed that part
    s += `<g clip-path="url(#${id})">` + cuts.map((c) => nest(cuts.filter((o) => o !== c), `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="none" stroke="${C.plum}" stroke-width="2.8"/>`)).join('') + '</g>';
    return s;
  };
  // teal sweatband with white stripes; tails fly back when running, droop when hurt
  const band = (limp) => {
    let s = shape('M8 4.5H68V12.5H8Z', TE, null, { sw: 2.4 }) + strokeD('M10 7.6H66', W, 1.8) + strokeD('M10 10.2H66', W, 1.8);
    s += limp ? shape('M8 8.5L4 14L7 19L10 16Z', TE, null, { sw: 2 }) : shape('M8 8.5L1.8 5.2L3.2 9L1.8 13.4Z', TE, null, { sw: 2 });
    return s + `<circle cx="8" cy="8.5" r="3.1" fill="${TE}" stroke="${C.plum}" stroke-width="2"/>`;
  };
  // big gap-toothed grin
  const grin = () => shape('M27.5 34.5H48.5Q48.5 43.5 38 43.5Q27.5 43.5 27.5 34.5Z', C.plum, null, { sw: 2.4 }) +
    flat('M29.5 36H35.5V40.5H29.5Z', W) + flat('M40.5 36H46.5V40.5H40.5Z', W) + flat('M32 42.5Q38 38.5 44 42.5Q38 45 32 42.5Z', C.coralL);
  let b = '';
  if (!hurt) {
    // sprint: a plants the back leg and kicks the front one up, b swaps them; arms pump the other way; b bobs up 1 and leans 4 deg instead of 6 (the canvas has no headroom above the band); speed lines behind
    b += walkB
      ? limb('M30 48Q23 50 21 55', G, 6) + nub(19, 58.3, -1, TE, 1.1) + limb('M46 48L54 56', G, 6) + nub(58, 61.5, 1, TE, 1.1)
      : limb('M30 48L22 56', G, 6) + nub(18, 61.5, -1, TE, 1.1) + limb('M46 48Q53 50 55 55', G, 6) + nub(57, 58.3, 1, TE, 1.1);
    let up = rot(sliceBody() + band(false) +
      ovalEye(29, 25, 6.8, 7.6, 1.8, 0.5, { sw: 3, pr: 4 }) + ovalEye(47, 25, 6.8, 7.6, 1.8, 0.5, { sw: 3, pr: 4 }) +
      strokeD('M23 15.5Q29 13.2 35 15.2', C.plum, 3) + strokeD('M41 15.2Q47 13.2 53 15.5', C.plum, 3) +
      melonSeed(20, 29, -20, 1.1) + melonSeed(56, 29, 20, 1.1) + melonSeed(21.5, 39, -35, 1.1) + melonSeed(54.5, 39, 35, 1.1) + grin(), walkB ? 4 : 6, 38, 28);
    up += walkB
      ? limb('M12 23Q6 22 7 15', G, 5) + mitt(7.5, 12, 3.6, 128, G) + limb('M64 29Q69 31 67.5 37', G, 5) + mitt(67.5, 39.5, 3.6, 118, G)
      : limb('M12 23Q7 25 6 31', G, 5) + mitt(6, 33.5, 3.6, 0, G) + limb('M64 29Q70 28 68.5 21', G, 5) + mitt(68.5, 18, 3.6, -10, G);
    b += walkB ? `<g transform="translate(0 -1)">${up}</g>` : up;
    b += strokeD('M2.5 40L9.5 40', C.lav, 2.2) + strokeD('M2.5 46L8.5 46', C.lav, 2.2) + strokeD('M4 52L10.5 52', C.lav, 2.2);
    return b;
  }
  // hurt: bite out of the right side, > < eyes, tear streams, wail
  b += limb('M31 48L26 56', G, 6) + nub(22, 61.5, -1, TE, 1.1) + limb('M45 48L51 56', G, 6) + nub(53, 61.5, 1, TE, 1.1);
  b += limb('M11 24Q5 26 5.5 35', G, 5) + mitt(5.5, 37.5, 3.6, 0, G);
  const tear = (d) => strokeD(d, C.plum, 5.2) + strokeD(d, C.sky, 2.4);
  b += rot(sliceBody([[66, 19, 9], [63, 32, 10], [55, 44, 9]]) + band(true) +
    strokeD('M19 16L28 23.5L19 31', C.plum, 4) + strokeD('M47 16L38 23.5L47 31', C.plum, 4) +
    shape('M27 37Q27 32.5 30 33.5Q33 31.5 36 33.5Q39 32.5 39 37Q39 43 33 43Q27 43 27 37Z', C.plum, null, { sw: 2.2 }) + flat('M29.5 40.5Q33 37 36.5 40.5Q33 43 29.5 40.5Z', C.coralL) +
    tear('M21 32Q18 36 20 41') + tear('M46 32Q47 36 46 40'), -5, 38, 28);
  b += drop(66, 3, 1.1) + shape(star(9, 8, 4.5, 2, 5), C.gold, null, { sw: 1.6 }) + `<circle cx="69.5" cy="27" r="2.4" fill="${CO}" stroke="${C.plum}" stroke-width="1.6"/><circle cx="68" cy="43" r="2" fill="${CO}" stroke="${C.plum}" stroke-width="1.6"/>`;
  b += strokeD('M54 52L61 55', C.lav, 2.2) + strokeD('M62 48L68 50', C.lav, 2.2);
  return b;
}
add('enemy_slice_a', () => slice('a'));
add('enemy_slice_b', () => slice('b'));
add('enemy_slice_hurt', () => slice('hurt'));

// ---------- canned beans (tin-can knight) ----------
function beans(f) {
  if (!['a', 'b', 'tell', 'hurt'].includes(f)) throw new Error(`beans: unknown frame "${f}"`);
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const CH = C.chrome, CHD = C.chromeD, CHL = C.chromeL, SO = C.soda, SOD = C.sodaD, W = C.white, COL = C.coralL, CO = C.coral, COD = C.coralD,
    GO = C.gold, BR = C.bread, BRD = C.breadD, BRL = C.breadL, PS = C.plumSoft, LAV = C.lav, PL = C.plum;
  const SLAB = 'M18 27L18 76Q18 81 23 81L57 81Q62 81 62 76L62 27Z';
  const SLAB_DENT = 'M18 27L18 76Q18 81 23 81L57 81Q62 81 62 76L62 67Q53 60 62 51L62 27Z';
  const bean = (x, y, rx, ry, deg) => `<g transform="rotate(${deg} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${BR}" stroke="${PL}" stroke-width="2"/>` +
    strokeD(`M${n(x - rx * 0.6)} ${n(y - ry * 0.35)}Q${x} ${n(y - ry * 0.75)} ${n(x + rx * 0.6)} ${n(y - ry * 0.3)}`, BRL, 1.6) +
    strokeD(`M${n(x - rx * 0.3)} ${n(y + ry * 0.5)}Q${n(x + rx * 0.2)} ${n(y + ry * 0.2)} ${n(x + rx * 0.6)} ${n(y + ry * 0.4)}`, BRD, 1.4) + `</g>`;
  const tin = () => {
    const d = hurt ? SLAB_DENT : SLAB;
    let s = clipTo(d, `<rect x="16" y="25" width="48" height="58" fill="${CH}"/><rect x="16" y="36" width="48" height="34" fill="${SO}"/>` +
      `<rect x="53" y="25" width="10" height="11" fill="${CHD}"/><rect x="53" y="36" width="10" height="34" fill="${SOD}"/><rect x="53" y="70" width="10" height="13" fill="${CHD}"/>` +
      `<rect x="21" y="38" width="3" height="28" rx="1.5" fill="${COL}" fill-opacity=".6"/><rect x="21" y="28" width="3" height="6" rx="1.5" fill="${W}" fill-opacity=".7"/><rect x="21" y="72" width="3" height="6" rx="1.5" fill="${W}" fill-opacity=".7"/>`);
    s += strokeD(d, PL, 3) + strokeD('M18 36L62 36M18 70L62 70', PL, 2.2) + strokeD('M18 75L62 75', PL, 1.4);
    return s + `<circle cx="24" cy="31.5" r="1.3" fill="${PS}"/><circle cx="56" cy="31.5" r="1.3" fill="${PS}"/><circle cx="24" cy="78" r="1.3" fill="${PS}"/><circle cx="56" cy="78" r="1.3" fill="${PS}"/>`;
  };
  // the opened top with beans heaped over the rim
  const topBeans = () => {
    let s = `<ellipse cx="40" cy="27" rx="22" ry="6.5" fill="${CH}" stroke="${PL}" stroke-width="2.6"/><ellipse cx="40" cy="27.5" rx="18" ry="4.4" fill="${COD}"/>`;
    s += bean(29, 21, 6, 4.2, -25) + bean(51, 21, 6, 4.2, 25) + bean(40, 15.5, 6.2, 4.4, 8) + bean(34, 24, 5.4, 3.8, 40) + bean(46, 24, 5.4, 3.8, -38);
    return s + flat('M27 25Q32 28 36 25Q35 30 31 30Q27 29 27 25Z', COD) + flat('M44 26Q49 29 53 25Q53 30 49 30Q45 30 44 26Z', COD);
  };
  // the peeled lid as a visor: snapped down over an eye slit when lowered
  const visor = (lowered) => {
    let s = '';
    if (!lowered) {
      s += shape('M17 40Q17 29 40 29Q63 29 63 40L63 44Q40 52 17 44Z', CH, null);
      s += flat('M20 38Q22 31 32 30Q25 33 24 40Z', W, 'fill-opacity=".75"') + flat('M58 36Q62 40 62 43Q55 46 50 46Q58 43 58 36Z', CHD);
      s += strokeD('M24 39Q40 33 56 39', PL, 1.8) + `<ellipse cx="40" cy="35" rx="4.4" ry="2.8" fill="${CHL}" stroke="${PL}" stroke-width="2"/>`;
    } else {
      s += shape('M16 42Q16 29 40 29Q64 29 64 42L64 55Q40 62 16 55Z', CH, null);
      s += flat('M19 40Q21 31 32 30Q25 33 23 42Z', W, 'fill-opacity=".75"') + flat('M58 38Q63 42 63 54Q56 57 50 58Q59 54 58 38Z', CHD);
      s += `<ellipse cx="40" cy="35" rx="4.4" ry="2.8" fill="${CHL}" stroke="${PL}" stroke-width="2"/>` + strokeD('M24 38Q40 32 56 38', PL, 1.8);
      s += flat('M20 44L40 49L60 44L60 52Q40 55 20 52Z', PL) + strokeD('M20 44L40 49L60 44L60 52Q40 55 20 52Z', PL, 1.8);
      s += `<ellipse cx="30.5" cy="50" rx="5.2" ry="2.5" fill="${CO}" transform="rotate(14 30.5 50)"/><ellipse cx="49.5" cy="50" rx="5.2" ry="2.5" fill="${CO}" transform="rotate(-14 49.5 50)"/><circle cx="32" cy="50.6" r="1.3" fill="${W}"/><circle cx="48" cy="50.6" r="1.3" fill="${W}"/>`;
      s += `<circle cx="20" cy="49" r="1.3" fill="${PS}"/><circle cx="60" cy="49" r="1.3" fill="${PS}"/>`;
    }
    return s;
  };
  const leg = (d, x, y, dir) => limb(d, CH, 5.8) + nub(x, y, dir, CHD, 1.15);
  let pre = '', b = '', post = '';
  if (tell) {
    // charging: back leg kicks up behind, front leg reaches ahead
    pre += leg('M30 79Q23 82 17 80', 14, 82, -1) + leg('M52 82L57 88', 57, 91, 1);
    pre += rays([[4, 36, 13, 36], [3, 48, 11, 48], [5, 60, 14, 60]], LAV, 2.6);
    b += tin() + topBeans() + visor(true) + teethRow(33, 63.5, 14, 6, 4, W);
    b += limb('M18 52Q9 54 4 47', CH, 5.8) + mitt(2.5, 45, 4.6, -60, CH) + limb('M62 54Q69 59 66 67', CH, 5.8) + mitt(66, 69.5, 4.8, 0, CH);
    post += rot(b, 13, 40, 80) + bean(10, 18, 4.4, 3.2, 30) + bean(20, 8, 4, 3, -20);
    post += `<ellipse cx="12" cy="90" rx="4.5" ry="2.4" fill="${CHL}" stroke="${PL}" stroke-width="1.5"/><ellipse cx="4" cy="86" rx="3" ry="1.8" fill="${CHL}" stroke="${PL}" stroke-width="1.4"/>`;
    return `<g transform="translate(0 -1)">${pre}${post}</g>`;
  }
  if (hurt) {
    // stunned: squeezed eyes, "ow" mouth, visor swung off one hinge, beans popping out
    pre += leg('M31 79L28 86', 27, 91, -1) + leg('M50 79L53 86', 53, 91, 1);
    b += tin() + topBeans();
    b += strokeD('M26 50L37 54.5L26 59', PL, 3.4) + strokeD('M54 50L43 54.5L54 59', PL, 3.4);
    b += strokeD('M24 46L37 49', PL, 3.2) + strokeD('M56 46L43 49', PL, 3.2);
    b += shape('M34 63Q37 60 40 63Q43 60 46 63Q47 70 40 70Q33 70 34 63Z', PL, null, { sw: 2 }) + shape('M37 67.5Q40 65.5 43 67.5Q42 70 40 70Q38 70 37 67.5Z', COL, null, { sw: 1.2 });
    // the clang: big dent, ring, impact lines
    b += flat('M62 51Q53 60 62 67L58 70Q46 60 56 49Z', SOD) + strokeD('M62 51Q53 60 62 67', PL, 2.4);
    b += strokeD('M52 52L44 46M50 60L40 60M52 66L44 72', SOD, 2.2);
    b += shape(star(58, 58, 9, 4.2, 8), GO, null, { sw: 1.8 });
    b += rot(visor(false), -33, 20, 38);
    b += limb('M18 52Q12 50 12 42', CH, 5.8) + mitt(12, 39, 4.6, -20, CH) + limb('M62 56Q73 52 74 42', CH, 5.8) + mitt(74, 39, 4.6, 20, CH);
    post += bean(62, 12, 4.6, 3.2, 40) + bean(52, 6, 4.2, 3, -30) + bean(13, 14, 4.2, 3, 20);
    post += shape(star(70, 22, 5, 2.2, 5), GO, null, { sw: 1.6 }) + shape(star(26, 8, 4.4, 2, 5), GO, null, { sw: 1.6 }) + drop(66, 30, 0.9, C.sky);
    return `<g transform="translate(0 -1)">${pre}${rot(b, -5, 40, 86)}${post}</g>`;
  }
  // a = standing; b = walk partner: left foot lifted and forward, body bobbed up 1.5, arms swung the other way
  pre += walkB ? leg('M31 78L29.5 83', 27.5, 88, -1) + leg('M50 79L51 86', 51, 91, 1) : leg('M31 79L30 86', 29, 91, -1) + leg('M50 79L51 86', 51, 91, 1);
  b += tin() + topBeans();
  // little dent in the label
  b += strokeD('M21 61L26 64L22 68', SOD, 1.8) + strokeD('M26 64L30 63', SOD, 1.8);
  b += ovalEye(31.5, 54.5, 5.2, 5.8, 1.4, 0.8, { pr: 2.8, lid: 0.34, tilt: 10, lc: SO }) + ovalEye(48.5, 54.5, 5.2, 5.8, -1.4, 0.8, { pr: 2.8, lid: 0.34, tilt: -10, lc: SO });
  b += strokeD('M34 65.5Q40 62 46 65.5', PL, 3) + strokeD('M37 68.5Q40 67.2 43 68.5', PL, 1.5);
  b += visor(false);
  b += walkB ? limb('M18 52Q9 58 12 69', CH, 5.8) + mitt(12, 71.5, 4.8, 0, CH) + limb('M62 52Q73 54 72 62', CH, 5.8) + mitt(72, 64.5, 4.8, 0, CH)
    : limb('M18 52Q8 57 11 66', CH, 5.8) + mitt(11, 68.5, 4.8, 0, CH) + limb('M62 52Q72 57 69 66', CH, 5.8) + mitt(69, 68.5, 4.8, 0, CH);
  // the mockup stands 1px below the sprite's ground anchor (0.95 x h)
  return `<g transform="translate(0 -1)">${pre}${walkB ? `<g transform="translate(0 -1.5)">${b}</g>` : b}</g>`;
}
add('enemy_beans_a', () => beans('a'));
add('enemy_beans_b', () => beans('b'));
add('enemy_beans_tell', () => beans('tell'));
add('enemy_beans_hurt', () => beans('hurt'));

// ---------- cereal box (sugar-rush mascot, cut-out flap shield) ----------
function cereal(f) {
  if (!['a', 'b', 'tell', 'hurt'].includes(f)) throw new Error(`cereal: unknown frame "${f}"`);
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const GO = C.gold, GOD = C.goldD, CO = C.coral, COD = C.coralD, COL = C.coralL, CR = C.cream, CRD = C.creamD, W = C.white, PL = C.plum,
    PS = C.plumSoft, LAV = C.lav, LAVL = C.lavL, MINT = C.mintD, SKY = C.sky;
  const RINGS = [CO, LAVL, GO, MINT, W, CO, LAVL];
  const ring = (x, y, k = 0, r = 4.4, deg = 0, sy = 1) => `<g transform="rotate(${deg} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n(r * sy)}" fill="${RINGS[k % RINGS.length]}" stroke="${PL}" stroke-width="1.8"/><ellipse cx="${x}" cy="${y}" rx="${n(r * 0.38)}" ry="${n(r * 0.38 * sy)}" fill="${PS}"/></g>`;
  // the cut-out flap used as a shield; local coords centred, zigzag cut along the right edge
  const shield = (cx, cy, deg, wet = false) => {
    let s = `<g transform="translate(${cx} ${cy}) rotate(${deg})">`;
    s += shape('M-11 -13L11 -13L9 -9L11 -5L9 -1L11 3L9 7L11 11L9 13L-11 13Z', wet ? GOD : GO, null, { sw: 2.8 });
    s += flat('M-8 -10L7 -10L7 10L-8 10Z', wet ? GO : CR) + strokeD('M-8 -10L7 -10L7 10L-8 10Z', PL, 1.4);
    s += shape(star(-0.5, 0, 7.2, 3.6, 8), wet ? CRD : GO, null, { sw: 1.8 }) + `<circle cx="-.5" cy="0" r="1.8" fill="${CO}"/>`;
    return s + '</g>';
  };
  const carton = () => {
    let s = '';
    if (hurt) {
      // soggy: sagging walls, wet stain climbing from the bottom
      s += shape('M49 34L60 29L61 56Q58 68 60 78L49 85Z', GOD, null);
      s += shape('M15 34L49 34Q47 50 50 62Q48 76 49 85Q41 88 32 84Q24 88 15 84Q18 72 14 62Q17 48 15 34Z', GO, null);
      s += flat('M16 66Q24 62 32 67Q41 62 49 66L49 85Q41 88 32 84Q24 88 15 84Z', GOD, 'fill-opacity=".75"') + flat('M49 66L60 62L60 78L49 85Z', GOD, 'fill-opacity=".5"');
      s += strokeD('M15 34Q17 48 14 62Q18 72 15 84Q24 88 32 84Q41 88 49 85Q48 76 50 62Q47 50 49 34', PL, 3);
    } else {
      s += shape('M49 34L60 29L60 79L49 85Z', GOD, null);
      s += shape('M15 34L49 34L49 85L15 83Z', GO, null);
      s += flat('M15 74L49 74L49 85L15 83Z', CO) + flat('M49 74L60 70L60 79L49 85Z', COD) + strokeD('M15 74L49 74L60 70', PL, 2.2) + strokeD('M15 83L49 85L60 79', PL, 3);
      s += `<circle cx="22" cy="79" r="1.8" fill="${CR}"/><circle cx="32" cy="80" r="1.8" fill="${CR}"/><circle cx="42" cy="80" r="1.8" fill="${CR}"/>`;
      s += flat('M18 38L21 38L21 70L18 70Z', CR, 'fill-opacity=".45"');
    }
    // top opening
    return s + shape('M15 34L49 34L60 29L27 29Z', hurt ? W : CRD, null, { sw: 2.6 });
  };
  const heap = () => {
    if (hurt) {
      // soggy rings drowning in a milk puddle, hair slumping down the sides
      let s = flat('M17 33L48 33L57 30L30 30Z', W);
      s += ring(25, 30, 0, 4.4, 10, 0.7) + ring(36, 29, 1, 4.4, -10, 0.7) + ring(46, 31, 2, 4.2, 20, 0.7) + ring(31, 33, 3, 4, 0, 0.6);
      return s + ring(9, 36, 0, 4.2, 20) + ring(11, 45, 0, 4, -10, 0.8) + ring(57, 33, 1, 4, 30, 0.8);
    }
    let s = ring(24, 18, 0, 4.6) + ring(35, 15, 1, 4.6, 20) + ring(46, 17, 2, 4.6) + ring(55, 22, 3, 4.4, 10);
    s += ring(18, 24, 3, 4.4, 30, 0.8) + ring(29, 22, 4, 4.6) + ring(40, 22, 0, 4.6, 40, 0.8) + ring(50, 26, 1, 4.4);
    s += ring(21, 31, 2, 4.4, 0, 0.8) + ring(32, 29, 3, 4.4) + ring(43, 29, 4, 4.4, 20) + ring(54, 29, 2, 4);
    return s + ring(10, 33, 1, 4.2, 0) + ring(13, 41, 0, 3.8, 30, 0.8);
  };
  const mug = () => {
    let s = '';
    if (hurt) {
      s += strokeD('M19.5 41L28.5 46.5L19.5 52', PL, 3.4) + strokeD('M45.5 41L36.5 46.5L45.5 52', PL, 3.4);
      s += strokeD('M19 37Q23 33 28 36', PL, 2.8) + strokeD('M46 37Q42 33 37 36', PL, 2.8);
      return s + shape('M23 58Q26 55 31 58Q36 55 41 58Q43 69 32 69Q21 69 23 58Z', PL, null, { sw: 2 }) + shape('M27 65Q32 62 37 65Q35 69 32 69Q29 69 27 65Z', COL, null, { sw: 1.2 });
    }
    if (tell) {
      s += ovalEye(26, 46, 6.4, 8, 1, 1, { pr: 2.4, sclera: COL, lid: 0.26, tilt: 16, lc: GO }) + ovalEye(41, 46, 6.4, 8, -1, 1, { pr: 2.4, sclera: COL, lid: 0.26, tilt: -16, lc: GO });
      s += strokeD('M19 36L32 41', PL, 3.4) + strokeD('M48 36L35 41', PL, 3.4);
      s += shape('M18 55Q32 50 46 55Q48 73 32 73Q16 73 18 55Z', PL, null, { sw: 2.4 }) + flat('M20 56Q32 52 44 56L43.5 62Q32 58.5 20.5 62Z', W) + strokeD('M26 54.5L26 60M32 53.5L32 59.5M38 54.5L38 60', PL, 1.5);
      return s + shape('M23 71Q32 62 41 71Q32 74 23 71Z', CO, null, { sw: 1.6 });
    }
    s += ovalEye(26.5, 46.5, 6.4, 8, 1.5, -1.8, { pr: 2.3 }) + ovalEye(41, 46, 6.4, 8, -1.5, 2.2, { pr: 2.3 });
    s += strokeD('M19 36Q25 31 32 35.5', PL, 3) + strokeD('M35 36L47 39.5', PL, 3);
    s += shape('M19 58Q32 54 45 58Q45 71 32 71Q19 71 19 58Z', PL, null, { sw: 2.4 }) + flat('M21 58.6Q32 55.6 43 58.6L42.4 63.5Q32 60.6 21.6 63.5Z', W) + strokeD('M26.5 57L26.5 62M32 56.5L32 61.5M37.5 57L37.5 62', PL, 1.5);
    return s + shape('M24 69Q32 62.5 40 69Q32 72 24 69Z', CO, null, { sw: 1.6 });
  };
  const leg = (x, y, d) => limb(`M${x} 84L${x} ${y - 4}`, GO, 5.8) + nub(x, y, d, CO, 1.15);
  let pre = '', b = '', post = '';
  if (hurt) {
    pre += limb('M24 85Q22 90 24 91', GO, 5.8) + nub(23, 95, -1, CO, 1.15) + limb('M42 85Q44 90 42 91', GO, 5.8) + nub(43, 95, 1, CO, 1.15);
    b += carton() + heap() + mug();
    // milk dribbling down the sides, from the mouth and from the flap
    b += shape('M12 35L17 35L16.5 46Q19 49 17.5 53Q15 57 11.5 54Q8.5 51 12 46Z', W, null, { sw: 2 }) + shape('M60 31L64 29.5L64 42Q67 45 65.5 49Q63 53 60.5 50Q58 47 60 42Z', W, null, { sw: 2 });
    b += shape('M39 68Q43 74 41 77Q38 77 38 74Z', W, null, { sw: 1.6 });
    b += limb('M15 56Q8 60 10 66', GO, 5.8) + mitt(10, 67, 4.4, 0, GO) + shield(15, 78, 12, true);
    b += limb('M60 52Q67 60 64 71', GO, 5.8) + mitt(64, 73, 4.4, 0, GO);
    post += drop(5, 60, 0.9, W) + drop(70, 56, 0.8, W) + drop(66, 22, 0.9, SKY) + shape(star(72, 12, 4.4, 2, 5), GO, null, { sw: 1.6 }) + shape(star(6, 14, 4.4, 2, 5), GO, null, { sw: 1.6 });
    // the soggy rings at the far left would leave the canvas, so the whole frame moves 1px right
    return `<g transform="translate(1 -1.25)">${pre}${rot(b, -5, 35, 90)}${post}</g>`;
  }
  if (tell) {
    pre += leg(24, 95, -1) + leg(43, 95, 1);
    b += carton() + heap() + mug();
    b += limb('M60 50Q70 44 70 32', GO, 5.8) + mitt(70, 29, 4.8, 10, GO);
    b += limb('M15 54Q8 62 10 74', GO, 5.8) + shield(12.5, 57, 4) + mitt(10, 77, 4.6, 0, GO);
    post += rays([[66, 52, 74, 49], [67, 59, 76, 59], [66, 66, 74, 69]], LAV, 2.6);
    post += rays([[28, 8, 28, 3], [44, 10, 48, 5], [14, 12, 10, 8]], LAV, 2.4);
    return `<g transform="translate(0 -1.25)">${pre}${rot(b, 3, 35, 90)}${post}</g>`;
  }
  // a = standing; b = walk partner: right foot lifted and forward, body bobbed up 1.5, the arms swung the other way
  pre += walkB ? leg(24, 95, -1) + leg(44, 92, 1) : leg(24, 95, -1) + leg(43, 95, 1);
  b += carton() + heap() + mug();
  b += walkB ? limb('M60 52Q70 51 70 42', GO, 5.8) + mitt(70, 39, 4.8, 10, GO) : limb('M60 52Q70 48 70 37', GO, 5.8) + mitt(70, 34, 4.8, 10, GO);
  b += walkB ? limb('M15 52Q6 51 8 58', GO, 5.8) + shield(15, 70, -8) + mitt(9, 59, 4.6, 0, GO) : limb('M15 52Q6 54 7 62', GO, 5.8) + shield(14, 74, -5) + mitt(8, 63, 4.6, 0, GO);
  post += rays([[7, 28, 3, 24], [6, 38, 2, 38]], LAV, 2.2) + shape(star(72, 22, 4.4, 2, 5), GO, null, { sw: 1.6 });
  // the mockup stands 1.25px below the sprite's ground anchor (0.95 x h)
  return `<g transform="translate(0 -1.25)">${pre}${walkB ? `<g transform="translate(0 -1.5)">${b}</g>` : b}${post}</g>`;
}
add('enemy_cereal_a', () => cereal('a'));
add('enemy_cereal_b', () => cereal('b'));
add('enemy_cereal_tell', () => cereal('tell'));
add('enemy_cereal_hurt', () => cereal('hurt'));

// ---------- honey jar (nurse grandma) ----------
function honey(f) {
  if (!['a', 'b', 'hurt'].includes(f)) throw new Error(`honey: unknown frame "${f}"`);
  const hurt = f === 'hurt', walkB = f === 'b';
  const W = C.white, CO = C.coral, COD = C.coralD, COL = C.coralL, GO = C.gold, GOD = C.goldD, BA = C.banana, BAL = C.bananaL,
    BRL = C.breadL, SKY = C.sky, PL = C.plum, LAV = C.lav;
  const limbS = (d, c) => limb(d, c, 5.6);
  const JAR = 'M20 33L56 33Q62 36 62 44L62 74Q62 80 56 80L20 80Q14 80 14 74L14 44Q14 36 20 33Z';
  // lid with the nurse cap and grey curls, drawn in jar coordinates so it can be moved as one piece
  const lidAndCap = () => {
    let s = shape('M18.5 24L57.5 24L58.5 33.5L17.5 33.5Z', CO, null) + flat('M52 24.5L57.5 24.5L58.3 33L53 33Z', COD);
    s += strokeD('M25 25.5L25 32', COD, 1.5) + strokeD('M31 25.5L31 32', COD, 1.5) + strokeD('M37 25.5L37 32', COD, 1.5) + strokeD('M43 25.5L43 32', COD, 1.5);
    s += dot(20.5, 24, 4.2, W, 2) + dot(55.5, 24, 4.2, W, 2);
    s += shape('M25.5 24.5L28 10Q38 5.5 48 10L50.5 24.5Z', W, null, { sw: 2.8 });
    s += flat('M44.5 10.6Q47.4 11 48 11.6L50 24L46.5 24Z', C.cream);
    return s + shape('M36 11.5L40 11.5L40 14.5L43.5 14.5L43.5 18.5L40 18.5L40 21.5L36 21.5L36 18.5L32.5 18.5L32.5 14.5L36 14.5Z', CO, null, { sw: 1.8 });
  };
  const jarBody = () => flat(JAR, GO) + flat('M52 34L61 40Q62 42 62 44L62 74Q62 80 56 80L46 80Q54 62 52 34Z', GOD) + flat('M16 44L21 40L21 70L16 68Z', BAL) + strokeD(JAR, PL, 3) + strokeD('M18.5 46L18.5 62', W, 2.2);
  const dipperPole = (x0, y0, x1, y1) => strokeD(`M${x0} ${y0}L${x1} ${y1}`, PL, 5.4) + strokeD(`M${x0} ${y0}L${x1} ${y1}`, BRL, 2.4);
  const dipperHead = (x, y, deg) => `<g transform="rotate(${deg} ${x} ${y})">` + ell(x, y, 5.6, 7.2, BRL, null, { sw: 2.4 }) +
    strokeD(`M${n(x - 5)} ${n(y - 3.5)}Q${x} ${n(y - 1.3)} ${n(x + 5)} ${n(y - 3.5)}`, PL, 1.6) + strokeD(`M${n(x - 5.5)} ${n(y + 0.5)}Q${x} ${n(y + 2.8)} ${n(x + 5.5)} ${n(y + 0.5)}`, PL, 1.6) +
    strokeD(`M${n(x - 4.8)} ${n(y + 4.5)}Q${x} ${n(y + 6.5)} ${n(x + 4.8)} ${n(y + 4.5)}`, PL, 1.6) + `</g>`;
  const heart = (x, y, s) => shape(`M${n(x)} ${n(y + 4.4 * s)}Q${n(x - 6.5 * s)} ${n(y - 0.5 * s)} ${n(x - 3.6 * s)} ${n(y - 3.4 * s)}Q${n(x - s)} ${n(y - 5.2 * s)} ${n(x)} ${n(y - 2.2 * s)}Q${n(x + s)} ${n(y - 5.2 * s)} ${n(x + 3.6 * s)} ${n(y - 3.4 * s)}Q${n(x + 6.5 * s)} ${n(y - 0.5 * s)} ${n(x)} ${n(y + 4.4 * s)}Z`, CO, null, { sw: 1.8 });
  const blush = `<ellipse cx="20.5" cy="61.5" rx="5" ry="3.4" fill="${COL}"/><ellipse cx="55.5" cy="61.5" rx="5" ry="3.4" fill="${COL}"/>`;
  // a = standing; b = walk partner: left foot lifted and forward, the rest bobbed up 1 and the arms swung the other way
  const legs = walkB ? limbS('M28 78L27 84', GO) + limbS('M48 78L48 86', GO) + nub(24.5, 88, -1, W) + nub(50, 91, 1, W)
    : limbS('M28 78L28 86', GO) + limbS('M48 78L48 86', GO) + nub(26, 91, -1, W) + nub(50, 91, 1, W);
  let b = '';
  if (hurt) {
    b += shape(star(8, 20, 5, 2.2, 5), GO, null, { sw: 1.6 }) + shape(star(66, 12, 4.4, 1.9, 5), GO, null, { sw: 1.6 });
    // flying lid and cap
    b += `<g transform="translate(16 14.5) rotate(-30) scale(.62) translate(-38 -26)">${lidAndCap()}</g>`;
    b += strokeD('M30 4L33 8', LAV, 2) + strokeD('M32 15L37 14', LAV, 2) + strokeD('M7 26L11 25', LAV, 2);
    let j = '';
    // limp left arm
    j += limbS('M14 58Q9 63 11 71', GO) + mitt(11.5, 73, 4.6, 0, GO);
    j += jarBody();
    // open jar mouth and honey splash
    j += shape('M16.5 33.5Q16.5 29.5 38 29.5Q59.5 29.5 59.5 33.5Q59.5 38.5 38 38.5Q16.5 38.5 16.5 33.5Z', GOD, null) + flat('M24 33Q38 31 52 33Q38 35.5 24 33Z', BA);
    // honey splash: a gloppy mound on the rim and a fan of flying drops
    j += shape('M17.5 33Q17 28.5 24 28Q28 25 32 28.5Q36 24.5 40 28.5Q45 25.5 48.5 28.5Q55 27.5 58.5 33Z', BA, null, { sw: 2.6 }) + flat('M24 31.5Q30 29.5 36 31.5', BAL, 'stroke="none"');
    for (const [x, y, deg, k] of [[35, 17, -10, 1.45], [47.5, 11, 22, 1.2], [55, 24, 60, 1.05]]) {
      j += `<g transform="translate(${x} ${y}) rotate(${deg})">${shape(`M0 ${n(-6 * k)}C${n(1.5 * k)} ${n(-3 * k)} ${n(4.4 * k)} ${n(-1.5 * k)} ${n(4.4 * k)} ${n(1.6 * k)}A${n(4.4 * k)} ${n(4.4 * k)} 0 0 1 ${n(-4.4 * k)} ${n(1.6 * k)}C${n(-4.4 * k)} ${n(-1.5 * k)} ${n(-1.5 * k)} ${n(-3 * k)} 0 ${n(-6 * k)}Z`, BA, null, { sw: 2 })}${flat(`M${n(-2 * k)} ${n(0.2 * k)}Q${n(-2 * k)} ${n(2.2 * k)} ${n(-0.4 * k)} ${n(3 * k)}`, BAL, 'stroke="none"')}</g>`;
    }
    j += dot(44, 3.6, 1.8, BA, 1.5) + dot(61, 16, 1.7, BA, 1.5) + dot(27, 20, 1.7, BA, 1.5);
    // squeezed eyes, wobbly ow mouth
    j += blush;
    j += strokeD('M25 47L33.5 52L25 57', PL, 3.4) + strokeD('M51 47L42.5 52L51 57', PL, 3.4);
    j += strokeD('M22 41.5Q27 37.5 33 40', PL, 2.6) + strokeD('M43 40Q49 37.5 54 41.5', PL, 2.6);
    j += shape('M30.5 64Q33 60 35.5 63.5Q38 60 40.5 63.5Q43 60 45.5 64Q46 73 38 73Q30 73 30.5 64Z', PL, null, { sw: 2.2 }) + flat('M33.5 70.8Q38 68 42.5 70.8Q38 73.8 33.5 70.8Z', COL);
    b += rot(squash(38, 80, 1.05, 0.94, j), -6, 38, 86);
    // dipper knocked askew
    b += dipperPole(66.5, 58, 62, 31) + limbS('M62 58Q69 59 67.5 51', GO) + mitt(66.5, 52, 4.6, 12, GO) + dipperHead(60.5, 25, -9);
    b += drop(63, 38, 1.1, SKY) + drop(9, 42, 1.1, SKY);
    return `<g transform="translate(0 -1)">${legs}${b}</g>`;
  }
  // waving left hand
  b += walkB ? limbS('M14 57Q9 60 11 53', GO) + mitt(11, 49.5, 4.6, -5, GO) : limbS('M14 57Q8.5 58 10 49', GO) + mitt(10, 45.5, 4.6, -15, GO);
  b += jarBody();
  // honey drips over the lid rim
  b += shape('M14.5 33.5L21 33.5L21 43Q21 48.5 17.7 48.5Q14.5 48.5 14.5 43Z', BAL, null, { sw: 2.2 }) + shape('M52 33.5L58.5 33.5L58.5 40Q58.5 45 55.2 45Q52 45 52 40Z', BAL, null, { sw: 2.2 }) + flat('M16.4 36.5L17.8 36.5L17.8 43L16.4 43Z', W);
  b += lidAndCap();
  // face
  b += blush;
  b += ovalEye(29, 52, 5.4, 6.8, 0.6, -0.6, { pr: 3.2, lid: 0.24, tilt: -8, lc: GO }) + ovalEye(47, 52, 5.4, 6.8, -0.6, -0.6, { pr: 3.2, lid: 0.24, tilt: 8, lc: GO });
  b += strokeD('M21.5 43.5Q27.5 39.5 34 42.5', PL, 2.6) + strokeD('M42 42.5Q48.5 39.5 54.5 43.5', PL, 2.6);
  b += shape('M31 62.5Q38 63.5 45 62.5Q43.5 71.5 38 71.5Q32.5 71.5 31 62.5Z', PL, null, { sw: 2.2 }) + flat('M34.5 69.4Q38 66.6 41.5 69.4Q38 72.2 34.5 69.4Z', COL);
  // honey dipper wand with a heart
  const wand = dipperPole(66.5, 56, 66.5, 24) + limbS('M62 58Q69 59 67.5 49.5', GO) + mitt(66.5, 46.5, 4.6, 0, GO) + dipperHead(66.5, 19.5, 0) +
    heart(66.5, 7.4, 1.05) + strokeD('M59.5 10L57.5 8', COD, 1.6) + strokeD('M72 10.5L71.5 8.5', COD, 1.6);
  b += walkB ? `<g transform="translate(0 1.2)">${rot(wand, -3, 62, 58)}</g>` : wand;
  // the mockup stands 1px below the sprite's ground anchor (0.95 x h)
  return `<g transform="translate(0 -1)">${legs}${walkB ? `<g transform="translate(0 -1)">${b}</g>` : b}</g>`;
}
add('enemy_honey_a', () => honey('a'));
add('enemy_honey_b', () => honey('b'));
add('enemy_honey_hurt', () => honey('hurt'));

// ---------- hand sanitizer / spray bottle (aura cleanser) ----------
// Neat-freak germophobe: pump bottle with a quiff pump head and yellow rubber gloves held up and out. a/b walk, hurt gags.
function sanitizer(f) {
  if (f !== 'a' && f !== 'b' && f !== 'hurt') throw new Error(`sanitizer: unknown frame "${f}"`);
  const W = C.white, SKY = C.sky, GO = C.gold;
  const sh = (d, fill, w = 3) => shape(d, fill, null, { sw: w });
  const ln = (d, w = 3, col = C.plum) => strokeD(d, col, w);
  const oval = (cx, cy, rx, ry, fill, w = 2.2, deg = 0) => { const e = ell(cx, cy, rx, ry, fill, null, { sw: w }); return deg ? rot(e, deg, n(cx), n(cy)) : e; };
  const limbS = (d) => limb(d, SKY, 5.6);
  const bodyFill = (d, light, dark, w = 3, dx = -3.5, dy = -3) => shape(d, light, dark, { sw: w, dx: -dx, dy: -dy });
  // fluffy mist puff
  const puff = (x, y, s = 1) => {
    const cs = [[0, 0, 5], [6.5, -2, 4], [-5.5, 2, 3.6], [3, 4.5, 4.2]].map(([a, b, r]) => [x + a * s, y + b * s, r * s]);
    return cs.map(([a, b, r]) => `<circle cx="${n(a)}" cy="${n(b)}" r="${n(r + 1)}" fill="${C.plum}"/>`).join('') + cs.map(([a, b, r]) => `<circle cx="${n(a)}" cy="${n(b)}" r="${n(r - 0.4)}" fill="${W}"/>`).join('');
  };
  // yellow rubber glove: four finger bumps, thumb, flared cuff. fingers point up before deg; flip mirrors it.
  const glove = (x, y, r, deg = 0, flip = false) => {
    let g = sh(`M${n(x - r * 0.6)} ${n(y + r * 0.6)}L${n(x + r * 0.6)} ${n(y + r * 0.6)}L${n(x + r * 0.88)} ${n(y + r * 1.6)}L${n(x - r * 0.88)} ${n(y + r * 1.6)}Z`, C.goldD, 2.2);
    for (const [dx, dy, a] of [[-0.68, -0.55, -16], [-0.23, -0.8, -5], [0.23, -0.8, 5], [0.68, -0.55, 16]]) g += oval(x + dx * r, y + dy * r, r * 0.27, r * 0.5, GO, 1.8, a);
    g += oval(x - r * 0.95, y + r * 0.05, r * 0.26, r * 0.46, GO, 1.8, -40);
    g += oval(x, y + r * 0.1, r * 0.92, r * 0.72, GO, 2.2);
    g += flat(`M${n(x - r * 0.6)} ${n(y - r * 0.15)}Q${n(x - r * 0.55)} ${n(y - r * 0.45)} ${n(x - r * 0.2)} ${n(y - r * 0.5)}Q${n(x - r * 0.45)} ${n(y - r * 0.3)} ${n(x - r * 0.4)} ${n(y + r * 0.1)}Z`, C.cream, 'opacity=".75"');
    return `<g transform="rotate(${deg} ${n(x)} ${n(y)})${flip ? ` translate(${n(2 * x)} 0) scale(-1 1)` : ''}">${g}</g>`;
  };
  const BODY = 'M26 33L50 33Q54 33 57 37L60 41Q62 43 62 47L62 72Q62 80 54 80L22 80Q14 80 14 72L14 47Q14 43 16 41L19 37Q22 33 26 33Z';
  // the bottle: collar, stem, quiff head, body, label. The head group can be bent (hurt).
  const bottle = (headT = '') => {
    let head = sh('M34 19L42 19L42 28L34 28Z', C.chromeL, 2.4);
    head += sh('M28 14.5L19.5 13L19.5 19L28 20Z', C.chrome, 2.4);
    head += bodyFill('M26 22.5Q20 14 27 8Q35 2 47 4Q57 6 65 3Q62 12 56 16Q53 22 47 22.5Z', W, C.chrome, 2.8, -3, -2.5);
    head += ln('M31 11.5Q38 7 47 8.5', 2, C.chromeD);
    let b = headT ? `<g transform="${headT}">${head}</g>` : head;
    b += sh('M28 26L48 26L50 34L26 34Z', C.chromeL, 2.8) + ln('M28.5 29.5L47.5 29.5', 1.6, C.chromeD);
    b += bodyFill(BODY, SKY, C.blue);
    b += flat('M18 46Q18 43 21 42L24 44Q21 46 21 56Z', W, 'opacity=".7"');
    // label with a coral clean-cross
    b += clipTo(BODY, `<rect x="10" y="65" width="56" height="16" fill="${C.cream}"/><path d="M50 65L66 65L66 81L42 81Z" fill="${C.creamD}"/>${ln('M10 65L66 65', 2)}`) + ln(BODY, 3);
    b += sh('M35.6 67.2L40.4 67.2L40.4 69.6L42.8 69.6L42.8 74.4L40.4 74.4L40.4 76.8L35.6 76.8L35.6 74.4L33.2 74.4L33.2 69.6L35.6 69.6Z', C.coral, 1.8);
    return b;
  };
  // nubs rest on y = 90 so their outline ends on the 0.95 x 96 = 91.2 ground line. b lifts the right foot forward.
  const legs = f === 'b'
    ? limbS('M28 79L27 85') + nub(25.5, 90, -1, W) + limbS('M48 79L51 83') + nub(54, 86.5, 1, W)
    : limbS('M28 79L27 85') + nub(25.5, 90, -1, W) + limbS('M48 79L49 85') + nub(50.5, 90, 1, W);

  if (f === 'hurt') {
    let b = sh(star(66, 12, 5.5, 2.4, 5), GO, 1.6) + sh(star(10, 14, 4.6, 2, 5), GO, 1.6);
    b += legs;
    let g = bottle('translate(1 5) rotate(-46 38 28)');
    g += limbS('M15 66Q12 68 12 61') + glove(12, 54.5, 6, -14);
    g += limbS('M61 66Q62 68 62 61') + glove(62, 54.5, 6, 14, true);
    // gagging: eyes squeezed shut, green round the gills, tongue out
    g += flat('M17 52Q15 62 24 66Q23 58 25 52Z', C.greenL, 'opacity=".75"') + flat('M59 52Q61 62 52 66Q53 58 51 52Z', C.greenL, 'opacity=".75"');
    g += ln('M24.5 41L35 47L24.5 53', 3.6) + ln('M51.5 41L41 47L51.5 53', 3.6);
    g += ln('M22 37L34 39.5', 3) + ln('M54 37L42 39.5', 3);
    g += sh('M28 59Q33 54 38 58Q43 54 48 59Q47 66 38 66.5Q29 66 28 59Z', C.plum, 2.2) + sh('M33 62.5Q38 60.5 43 62.5Q43 70 38 70.5Q33 70 33 62.5Z', C.coralL, 2);
    g += ln('M38 63.5L38 68', 1.4, C.coralD);
    g += drop(18, 51, 0.9, SKY) + drop(60, 38, 0.9, SKY);
    b += `<g transform="translate(38 91) rotate(3) scale(1.05 .93) translate(-38 -91)">${g}</g>`;
    b += rays([[4.5, 62, 2.5, 66], [71.5, 62, 73.5, 66]], C.lav, 2);
    return b;
  }
  // a / b: the body bobs up 1 px on b, the feet stay put
  let b = puff(11, 9, 0.7) + puff(8, 21, 0.48) + `<circle cx="14.5" cy="24" r="1.4" fill="${W}" stroke="${C.plum}" stroke-width="1.2"/>`;
  // gloves up and out: don't touch me (b swings them: left down and in, right up and out)
  b += f === 'b'
    ? limbS('M15 58Q10 60 11 53') + glove(11, 46, 6.2, -6) + limbS('M61 58Q66 55 65 46') + glove(65, 39, 6.2, 6, true)
    : limbS('M15 58Q10 57 11 49') + glove(11, 42, 6.2) + limbS('M61 58Q66 57 65 49') + glove(65, 42, 6.2, 0, true);
  b += bottle();
  // squinting disgust: slit eyes with a lowered lid, brows pinched, wobbly frown
  b += ovalEye(30.5, 47, 4.8, 5.4, -1.6, -0.4, { lid: 0.5, tilt: 0, bl: 0.2, lc: SKY }) + ovalEye(45.5, 47, 4.8, 5.4, -1.6, -0.4, { lid: 0.5, tilt: 0, bl: 0.2, lc: SKY });
  b += ln('M23.5 42L35.5 38', 3.2) + ln('M52.5 42L40.5 38', 3.2);
  b += sh('M26 59.5Q38 52 50 59.5L47.5 66.5Q38 62 28.5 66.5Z', W, 2.4) + ln('M27.5 63Q38 58.4 48.5 63', 1.5) + ln('M32 56.2L32.6 64M38 55.2L38 61M44 56.2L43.6 64', 1.4) + ln('M23 55.5L26 59.5M53 55.5L50 59.5', 1.6);
  return legs + (f === 'b' ? `<g transform="translate(0 -1)">${b}</g>` : b);
}
add('enemy_sanitizer_a', () => sanitizer('a'));
add('enemy_sanitizer_b', () => sanitizer('b'));
add('enemy_sanitizer_hurt', () => sanitizer('hurt'));

// ---------- gift card (loot thief) ----------
// Slick con artist: plastic card with a gift-bow tie, shifty eyes, tiptoeing off with a sack of coins over the shoulder.
function giftcard(f) {
  if (f !== 'a' && f !== 'b' && f !== 'hurt') throw new Error(`giftcard: unknown frame "${f}"`);
  const CO = C.coral, COD = C.coralD, COL = C.coralL, GO = C.gold, GOD = C.goldD, CR = C.cream, BR = C.bread, BRD = C.breadD;
  const sh = (d, fill, w = 3) => shape(d, fill, null, { sw: w });
  const ln = (d, w = 3, col = C.plum) => strokeD(d, col, w);
  const oval = (cx, cy, rx, ry, fill, w = 2.2, deg = 0) => { const e = ell(cx, cy, rx, ry, fill, null, { sw: w }); return deg ? rot(e, deg, n(cx), n(cy)) : e; };
  const limbS = (d) => limb(d, CO, 5.6);
  const bodyFill = (d, light, dark, w = 3, dx = -3.5, dy = -3) => shape(d, light, dark, { sw: w, dx: -dx, dy: -dy });
  // coin: flat disc (sq squashes it to an ellipse) with a stamped bar
  const coin = (x, y, r = 3.8, sq = 1, deg = 0) =>
    `<g transform="rotate(${deg} ${x} ${y})">${oval(x, y, r, r * sq, GO, 1.9)}${ln(`M${x} ${n(y - r * sq * 0.5)}L${x} ${n(y + r * sq * 0.5)}`, 1.3, GOD)}</g>`;
  // pointe shoe: a cream spat, toe down
  const toe = (x, y, deg = 0) => `<g transform="rotate(${deg} ${x} ${y})">${oval(x, y + 3.5, 3.4, 4.6, CR, 2.2)}</g>`;
  const CARD = 'M19 14L47 14Q54 14 54 21L54 63Q54 70 47 70L19 70Q12 70 12 63L12 21Q12 14 19 14Z';
  const bow = (x, y, deg = 0) => `<g transform="rotate(${deg} ${x} ${y})">` +
    sh(`M${x} ${y}L${n(x - 14)} ${n(y - 7)}Q${n(x - 16.5)} ${y} ${n(x - 14)} ${n(y + 7)}Z`, GO, 2.6) + sh(`M${x} ${y}L${n(x + 14)} ${n(y - 7)}Q${n(x + 16.5)} ${y} ${n(x + 14)} ${n(y + 7)}Z`, GO, 2.6) +
    ln(`M${n(x - 6)} ${n(y - 2.6)}L${n(x - 11)} ${n(y - 3.2)}M${n(x - 6)} ${n(y + 2.6)}L${n(x - 11)} ${n(y + 3.2)}M${n(x + 6)} ${n(y - 2.6)}L${n(x + 11)} ${n(y - 3.2)}M${n(x + 6)} ${n(y + 2.6)}L${n(x + 11)} ${n(y + 3.2)}`, 1.4, GOD) +
    oval(x, y, 3.2, 4.4, GOD, 2.2) + `</g>`;
  // card chest strip (barcode)
  const strip = () => `<rect x="12" y="59" width="42" height="7" fill="${CR}"/>${ln('M12 59L54 59', 1.8)}${ln('M12 66L54 66', 1.8)}` +
    [17, 20, 22.5, 26, 29, 31, 35, 38, 41, 43.5, 47, 50].map((x, i) => ln(`M${x} 60.4L${x} 64.6`, i % 3 === 0 ? 2.2 : 1.2)).join('');
  // whole upright card: fill, sheen, strip, outline. The strip is clipped so it stays inside the corners.
  const card = () => bodyFill(CARD, CO, COD) + flat('M16.5 22Q16.5 18.5 20 17.5L24 17.5Q19.5 20 19.5 32Z', COL, 'opacity=".85"') + clipTo(CARD, strip()) + ln(CARD, 3);
  // coin sack: round bulb, gathered neck with a tuft, tied with coral twine. open = mouth agape (no tuft)
  const sack = (open = false) => {
    const bulb = 'M60 27L67 27Q68 34 74 38Q83 44 82 54Q80 66 69 67Q57 66 56 54Q56 44 62 37Q61 32 60 27Z';
    let b = '';
    if (!open) b += sh('M56.5 19L70.5 19L67.5 28L59.5 28Z', BR, 2.4) + ln('M60 21L61 26M64 20L64 26M68 21L66.5 26', 1.3, BRD);
    b += bodyFill(bulb, BR, BRD, 3, -4, -3);
    b += ln('M58.5 44Q59 52 58 58', 1.8, C.breadL);
    b += coin(69.5, 52, 6.2);
    if (open) b += oval(63.5, 27, 8, 3.4, C.plumSoft, 2.6);
    else b += ln('M58.5 28.5L68.5 28.5', 4.8) + ln('M58.5 28.5L68.5 28.5', 2.4, CO);
    return b;
  };

  if (f === 'hurt') {
    let b = '';
    // coins flying out of the open sack
    b += coin(70, 22, 3.7, 0.75, 20) + coin(78, 12, 3.7, 1, 0) + coin(67, 7.5, 3.5, 0.8, -20) + coin(61, 15, 3.4, 1, 10);
    b += rays([[75, 27, 73, 32], [64, 12, 62, 17]], C.lav, 2);
    b += sh(star(9, 16, 5.2, 2.3, 5), GO, 1.6) + sh(star(21, 8, 4, 1.7, 5), GO, 1.6);
    // sack knocked loose, mouth open
    b += `<g transform="translate(-4 5) rotate(22 69 50)">${sack(true)}</g>`;
    b += coin(79, 66, 3.4, 0.8, 0);
    // feet flat, a little hop
    b += limbS('M23 69Q21 76 22 80') + oval(21, 83.1, 5, 3.2, CR, 2.2) + limbS('M42 69Q44 76 44 80') + oval(45, 83.1, 5, 3.2, CR, 2.2);
    b += limbS('M13 54Q8 55 9.5 47') + mitt(9.5, 44.5, 4.3, -20, CO);
    b += limbS('M52 44Q58 40 59 31') + mitt(59.5, 28.5, 4.3, 20, CO);
    // the card folds at the waist: the top half tips back, a dark wedge shows the inside
    const LOW = 'M12 44L54 44L54 63Q54 70 47 70L19 70Q12 70 12 63Z', UP = 'M12 44L12 21Q12 14 19 14L47 14Q54 14 54 21L54 44Z';
    b += bodyFill(LOW, CO, COD, 3) + clipTo(LOW, strip()) + ln(LOW, 3);
    b += sh('M12 44L54 44L52.9 34.9Z', COD, 2.4) + ln('M54 44L48 47L51 50', 1.6) + ln('M12 44L18 47.5L15 51', 1.6);
    let up = bodyFill(UP, CO, COD, 3) + flat('M16.5 22Q16.5 18.5 20 17.5L24 17.5Q19.5 20 19.5 32Z', COL, 'opacity=".85"');
    // > < eyes, wobbly "ow" mouth
    up += ln('M20 22.5L29 28.5L20 34.5', 3.4) + ln('M46.5 22.5L37.5 28.5L46.5 34.5', 3.4);
    up += ln('M17 17.5L28 20', 3) + ln('M49 17.5L38 20', 3);
    up += sh('M23 36Q26 32.5 29 36Q31.5 32.5 34 36Q37 32.5 40 36Q41.5 43 32 43.5Q22 43 23 36Z', C.plum, 2.2) + flat('M27 40.4Q32 38 37 40.4Q35 42.5 32 42.5Q29 42.5 27 40.4Z', COL);
    b += rot(up, -12, 12, 44);
    b += rot(bow(33, 53), -20, 33, 52);
    b += drop(4.2, 29, 0.9, C.sky) + drop(54, 17, 1, C.sky);
    return b;
  }
  // a / b: one foot planted, one lifted mid-step (b swaps them); on b the whole body bobs up 1.5 px and the free hand swings
  const walkB = f === 'b', bob = (inner) => (walkB ? `<g transform="translate(0 -1.5)">${inner}</g>` : inner);
  // sack over the shoulder (behind the card), tied, coins peeking
  let b = bob(coin(60.5, 15.5, 3.6, 1, -15) + coin(67, 14.5, 3.6, 1, 12) + coin(63.5, 11.5, 3.6, 1, 0) + sack());
  // legs on tiptoe
  b += walkB ? limbS('M23 69Q29 73 25 76') + toe(24.5, 75, 15) + limbS('M42 69Q44 75 45 78') + toe(45, 78.1, -12)
    : limbS('M23 69Q21 75 24 78') + toe(24, 78.1, 12) + limbS('M42 69Q50 73 46 76') + toe(45.5, 75, -15);
  let t = walkB ? limbS('M13 52Q9 52 10 46') + mitt(10, 43.5, 4.3, 0, CO) : limbS('M13 52Q8 55 9 61') + mitt(9, 63.5, 4.3, 0, CO);
  t += card();
  // shifty half-lidded eyes glancing sideways, one brow cocked
  t += ovalEye(24.8, 29, 5.5, 6.4, 3.3, 0.6, { lid: 0.4, tilt: -6, bl: 0.1, lc: CO }) + ovalEye(41, 29, 5.5, 6.4, 3.3, 0.6, { lid: 0.4, tilt: 6, bl: 0.1, lc: CO });
  t += ln('M18.5 22.5L30.5 24.5', 3.6) + ln('M36 22.5Q41.5 17.5 47 21', 3.6);
  // sly grin with a gold tooth
  t += sh('M21.5 38Q33 48.5 46 35.5Q41 44.5 33 45.5Q26 45 21.5 38Z', C.plum, 2.4) + sh('M36 40.6L39.4 38L40.4 41.4L37.2 43.4Z', GO, 1.2);
  t += bow(33, 50);
  // right arm up, gripping the sack neck; sparkle on the loot
  let r = limbS('M52 40Q60 41 57.5 34') + mitt(58, 31.5, 4.3, 160, CO) + rays([[77, 12, 77, 18], [74, 15, 80, 15]], GOD, 1.9);
  b += bob(rot(t, -3, 33, 70) + r);
  return b;
}
add('enemy_giftcard_a', () => giftcard('a'));
add('enemy_giftcard_b', () => giftcard('b'));
add('enemy_giftcard_hurt', () => giftcard('hurt'));

// ---------- expired milk (teleporter) ----------
// Zombie carton: sickly green gable-top with mould, a lav fin and hem, a crossed-out date stamp, stink lines and legs that
// fray into wisps. Nothing here uses opacity: the game flickers this enemy's own alpha during the tell.
function expired(f) {
  if (f !== 'a' && f !== 'b' && f !== 'tell' && f !== 'hurt') throw new Error(`expired: unknown frame "${f}"`);
  const W = C.white, G = C.green, GD = C.greenD, LD = C.lavD, LV = C.lav, CO = C.coral, COL = C.coralL, MT = C.mintL, MD = C.mintD, TD = C.tealD, GO = C.gold, SKY = C.sky;
  const sh = (d, fill, w = 3) => shape(d, fill, null, { sw: w });
  const ln = (d, w = 3, col = C.plum) => strokeD(d, col, w);
  const limbG = (d) => limb(d, G, 5.6);
  // the mockup's wisp tips trail 4.8 px below the ground line; lift the carton so the tips rest on it (the stink waves and sparkles stay put so nothing leaves the top)
  const up = (inner, dy = 4.8) => `<g transform="translate(0 ${-dy})">${inner}</g>`;
  const FRONT = 'M12 33L48 33L48 79L12 77Z';
  // the silhouette of the whole carton (fin, gable, body), used for the glitch echoes
  const SILH = 'M17 10L33 11.5L42 13.5L43 21L54 18L58 30L58 74L48 79L12 77L12 33L16 21Z';
  // side face; hurt = a bite torn out of its edge
  const sideFace = (hurt) => (hurt ? 'M48 33L58 30L58 43L52 47L56.5 51.5L51.5 56L58 60L58 74L48 79Z' : 'M48 33L58 30L58 74L48 79Z');
  // legs: a short stump of carton, then the leg frays into paler and thinner wisps (no opacity, only colour and width).
  // lift = the walking b frame raises and swings forward the left leg.
  const wisps = (lift) => {
    const w = (d, w1, col) => ln(d, w1) + ln(d, n(w1 - 3), col);
    const dotAt = (x, y) => `<circle cx="${x}" cy="${y}" r="1.3" fill="${MT}" stroke="${C.plum}" stroke-width="1"/>`;
    const legL = limbG('M25 78L25 83') + w('M25 83Q21 86 24.5 89', 5.2, MD) + w('M24.5 89Q27.5 90.5 25.5 92.5', 3.8, MT) + dotAt(21, 93);
    const legR = limbG('M42 79L42.5 83') + w('M42.5 83Q47 86 43 89', 5.2, MD) + w('M43 89Q40 90.5 42 92.5', 3.8, MT) + dotAt(46.5, 93.5);
    return (lift ? `<g transform="translate(3 -3.5)">${legL}</g>` : legL) + legR;
  };
  // mood: 'idle' | 'walk' | 'tell' | 'hurt'
  const zombie = (mood) => {
    const T = mood === 'tell', H = mood === 'hurt', B = mood === 'walk';
    const id = `c${++uid}`;
    let u = '';
    // left arm
    if (H) u += limbG('M12 52Q4 48 6 40') + mitt(6.5, 37, 4.4, 25, G);
    else if (T) u += limbG('M12 50Q5 47 5 38') + mitt(5, 35, 4.4, 30, G);
    else if (B) u += limbG('M12 52Q5 50 6 43') + mitt(6.5, 40.5, 4.4, 25, G);
    else u += limbG('M12 52Q5 60 8 70') + mitt(8.5, 72.5, 4.4, 5, G);
    // top fin, floppy and torn, with a flap hanging off its right end
    u += sh('M17 10L33 11.5L42 13.5L43 21L16 21Z', LV) + ln('M22 12.5L22 20', 1.6) + ln('M28 12L28 20', 1.6);
    u += sh('M36 13L42 13.5L43 21L38 21L39 17Z', LD, 1.8);
    // roof gable
    u += sh('M44 21L54 18L58 30L48 33Z', GD) + sh('M16 21L44 21L48 33L12 33Z', G);
    // body: side face, front face with mould blotches clipped to it, lav hem band
    u += sh(sideFace(H), GD) + sh(FRONT, G);
    u += `<clipPath id="${id}"><path d="${FRONT}"/></clipPath><g clip-path="url(#${id})">`;
    u += `<g fill="${GD}"><circle cx="13" cy="62" r="6.6"/><circle cx="19" cy="68" r="4"/><circle cx="46" cy="64" r="6.4"/><circle cx="41" cy="70" r="3.4"/><circle cx="47" cy="37" r="5"/><circle cx="13" cy="35" r="4.6"/></g>`;
    u += `<g fill="${TD}"><circle cx="11" cy="61" r="3.3"/><circle cx="17" cy="67" r="1.9"/><circle cx="47" cy="63" r="3.2"/><circle cx="48" cy="36" r="2.4"/><circle cx="12" cy="34" r="2.2"/></g><g fill="${MT}"><circle cx="9.5" cy="59.5" r="1.4"/><circle cx="45.5" cy="61.5" r="1.3"/><circle cx="47" cy="35" r="1"/><circle cx="13" cy="73" r="1.2"/></g></g>`;
    // mould on the shaded side too
    u += `<clipPath id="${id}m"><path d="${sideFace(H)}"/></clipPath><g clip-path="url(#${id}m)"><circle cx="53.4" cy="41" r="3" fill="${TD}"/><circle cx="53.6" cy="64" r="3" fill="${TD}"/><circle cx="52.6" cy="39.8" r="1" fill="${MT}"/></g>`;
    u += sh('M12 71L48 71.5L48 79L12 77Z', LV, 2.4) + sh('M48 71.5L58 69L58 74L48 79Z', LD, 2.4);
    u += ln(FRONT, 3);
    // hollow sockets round the eyes
    u += `<clipPath id="${id}s"><path d="${FRONT}"/></clipPath><g clip-path="url(#${id}s)">${flat('M13.5 45.5Q13.5 36 23 36Q32 36 32 45.5Q32 55.5 22.5 55.5Q13.5 55.5 13.5 45.5Z', GD)}${flat('M31.5 47.5Q31.5 40 38.5 40Q46 40 46 47.5Q46 55.5 38.5 55.5Q31.5 55.5 31.5 47.5Z', GD)}</g>`;
    if (H) {
      // squeezed eyes, "ow" mouth
      u += ln('M16 41L27 46.5L16 52', 3.6) + ln('M44 42L34 47.5L44 53', 3.6);
      u += sh('M20 59Q26 55.5 31 58.5Q36 55 41 59Q45 66 38 69Q31 72 24 69Q17 66 20 59Z', C.plum, 2) + flat('M25.5 65.5Q31 62 37 65.5Q34 70 31 70Q28 70 25.5 65.5Z', COL);
    } else if (T) {
      // wide coral eyes, angry brows, silent scream
      u += ovalEye(23, 46, 6.2, 7.4, 0, 0, { pr: 2.8, sclera: CO }) + ovalEye(38.5, 47.5, 5.8, 6.8, 0, 0, { pr: 2.6, sclera: CO });
      u += ln('M15 37L30 41.5', 3.2) + ln('M47 38.5L33 42', 3.2);
      u += sh('M19 59Q31 55 42 59Q46 69 31 71Q17 69 19 59Z', C.plum, 2) + sh('M23.5 58.5L27.5 58.5L27.5 63.5L23.5 63.5Z', W, 1.4) + sh('M33 58.5L37 58.5L37 63.5L33 63.5Z', W, 1.4);
    } else {
      // idle: one big dead eye, one droopy half-lidded eye, slack mouth with a lolling tongue and drool
      u += ovalEye(23, 46, 6.2, 7.4, 1.2, 2.6, { pr: 2.6, sclera: C.bananaL });
      u += ovalEye(38.5, 48, 5.4, 6.2, 0, 1.8, { pr: 2.3, sclera: C.bananaL, lid: 0.45, tilt: -10, lc: G });
      u += ln('M33 41.5L44 44.5', 2.4);
      u += sh('M18.5 60Q30 55.5 41.5 60Q44 68 31 70Q19 69 18.5 60Z', C.plum, 2) + flat('M22.5 59.5L26.5 59L26.5 63L22.5 63.5Z', W) + flat('M31 58.5L35 59L35 62.5L31 62.5Z', W);
      u += sh('M32.5 66Q41 65.5 42 73Q41 79 36.5 78Q32 77 32.5 70Z', COL, 1.9) + ln('M37 69L37 74', 1.4);
      u += ln('M19.5 66Q17.5 70 19.5 73.5', 1.8, MT) + `<circle cx="19.5" cy="75" r="1.8" fill="${MT}" stroke="${C.plum}" stroke-width="1.2"/>`;
    }
    // crossed-out date stamp on the roof
    u += `<g transform="rotate(-3 31 27)">${sh('M20.5 22.5L42 22.5L42 31L20.5 31Z', W, 1.6)}${ln('M23 25.5L26.5 25.5M23 28.5L26 28.5M36 25.5L39.5 25.5M36.5 28.5L39.5 28.5', 1.4)}${ln('M26.5 21L36 33', 4.6)}${ln('M36 21L26.5 33', 4.6)}${ln('M26.5 21L36 33', 2.4, CO)}${ln('M36 21L26.5 33', 2.4, CO)}</g>`;
    // right arm
    if (H) u += limbG('M57 54Q64 50 63.5 42') + mitt(63.5, 39, 4.4, -25, G);
    else if (T) u += limbG('M57 50Q61 46 61 39') + mitt(61, 36, 4.4, -35, G);
    else if (B) u += limbG('M57 52Q63 56 64 64') + mitt(64.5, 66.5, 4.4, -5, G);
    else u += limbG('M57 52Q63 49 62.8 42') + mitt(63.2, 39, 4.4, -30, G);
    // the walking b frame bobs the carton up 1.5 px; the legs stay on the floor
    return wisps(B) + (B ? `<g transform="translate(0 -1.5)">${u}</g>` : u);
  };
  const stink = () => {
    const wav = (x, y, col = GD) => ln(`M${x} ${y}Q${x - 4} ${y - 4} ${x} ${y - 8}Q${x + 4} ${y - 12} ${x} ${y - 16}`, 2.4, col);
    return wav(7, 30) + wav(63, 21) + wav(58, 33, TD) + wav(10, 18, TD) +
      `<circle cx="67" cy="8" r="1.6" fill="${C.plum}"/><ellipse cx="65.5" cy="6.5" rx="1.8" ry="1" fill="${W}"/><circle cx="4" cy="52" r="1.5" fill="${C.plum}"/>`;
  };
  // outline-only copy of the carton whose horizontal bands wobble sideways: the afterimage of the tell
  const echo = (dx, col, sw) => {
    let s = '';
    for (let i = 0, y = 6; y < 96; y += 7, i++) {
      const id = `c${++uid}`, w = dx + 2.4 * Math.sin(i * 1.3 + dx);
      s += `<clipPath id="${id}"><rect x="-40" y="${y}" width="160" height="7.2"/></clipPath><g clip-path="url(#${id})"><g transform="translate(${n(w + 3)} 0) rotate(2 34 91)"><path d="${SILH}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/></g></g>`;
    }
    return s;
  };

  if (f === 'tell') {
    // Tell: glitching out before it blinks away. The body is cut into bands that slip sideways, a coral and a sky outline split
    // off to each side, a wobbly lav afterimage trails left, glitch blocks flash round it, and wide coral eyes scream silently.
    // Everything is fully opaque, because the game flickers the sprite's own alpha during the tell.
    const bands = [[-10, 24, 0], [24, 31, 6], [31, 41, -3], [41, 57, 2.5], [57, 64, -6], [64, 73, 3], [73, 110, 0]];
    let b = echo(-10, LV, 2.6) + echo(-5, SKY, 3) + echo(5.5, CO, 3);
    for (const [y0, y1, dx] of bands) b += clipTo(`M-40 ${y0}L120 ${y0}L120 ${y1}L-40 ${y1}Z`, `<g transform="translate(${dx + 3} 0) rotate(2 34 91)">${zombie('tell')}</g>`);
    const px = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${C.plum}" stroke-width="1.2"/>`;
    b += px(1.5, 24, 6, 3.5, CO) + px(64, 44, 6, 3.5, SKY) + px(61, 50, 4, 3, CO) + px(2, 62, 6, 3.5, SKY) + px(58, 6, 5, 3, CO) + px(65, 66, 5, 3, CO) + px(9, 86, 5, 3, SKY) + px(6, 31, 4, 3, SKY);
    b += px(60, 34, 9, 4, G) + px(1, 74, 8, 4, LV);
    b += ln('M1.5 51L10 51', 2, SKY) + ln('M60 58L70 58', 2, CO) + ln('M3 41L8 41', 2, CO);
    return up(b);
  }
  if (f === 'hurt') {
    // Hurt: squashed and leaning back, eyes squeezed, "ow" mouth, a chunk bitten out of the carton's side with a puff of mould
    // spores bursting out of the tear, arms flung up, the date stamp still crossed out.
    let b = `<g transform="translate(3 0) rotate(-7 34 91)"><g transform="translate(34 91) scale(1.06 .93) translate(-34 -91)">${zombie('hurt')}</g></g>`;
    const puff = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${G}" stroke="${C.plum}" stroke-width="2"/>`;
    b += puff(59.5, 51, 5.3) + puff(65, 45, 4.4) + puff(66, 55, 3.8) + puff(61, 59, 4);
    b += `<g fill="${GD}"><circle cx="63" cy="49" r="1.8"/><circle cx="64" cy="57" r="1.4"/></g><circle cx="58.5" cy="52" r="1.3" fill="${MT}"/>`;
    b += `<g fill="${G}" stroke="${C.plum}" stroke-width="1.2"><circle cx="56" cy="38" r="1.9"/><circle cx="68" cy="37" r="1.6"/><circle cx="69" cy="64" r="1.6"/><circle cx="55" cy="70" r="1.4"/></g>`;
    b += ln('M2 32L7 33', 1.8, LV) + ln('M3 24L8 27', 1.8, LV) + sh('M60 28L67 25L65 32Z', GD, 1.6) + sh('M66 72L71 68L70 74Z', G, 1.6);
    b = up(b, 5.1) + sh(star(9, 15, 5, 2.2, 5), GO, 1.6) + sh(star(49, 7, 4, 1.8, 5), GO, 1.6) + drop(4, 58, 0.9, SKY) + drop(67, 24, 0.8, SKY);
    // the raised left hand and the spore cloud span 76 units, wider than the 72 canvas: fit the whole pose (feet stay on the ground)
    return `<g transform="translate(36 91.2) scale(.934) translate(-34 -91.2)">${b}</g>`;
  }
  return up(`<g transform="rotate(3 34 91)">${zombie(f === 'b' ? 'walk' : 'idle')}</g>`) + stink();
}
add('enemy_expired_a', () => expired('a'));
add('enemy_expired_b', () => expired('b'));
add('enemy_expired_tell', () => expired('tell'));
add('enemy_expired_hurt', () => expired('hurt'));

// ---------- bubble gum ----------
// Rebellious teen wad: wrapper worn as a bandana, blowing a bubble, sticky strand to a floor puddle. tell: bubble about to pop.
function gum(f) {
  if (f !== 'a' && f !== 'b' && f !== 'tell' && f !== 'hurt') throw new Error(`gum: unknown frame "${f}"`);
  const T = f === 'tell', H = f === 'hurt', walkB = f === 'b';
  const W = C.white, TE = C.teal, CO = C.coral, COL = C.coralL, PK = C.pink, PKD = C.pinkD, PKL = C.pinkL;
  const sh = (d, fill, w = 3) => shape(d, fill, null, { sw: w });
  const ln = (d, w = 3, col = C.plum) => strokeD(d, col, w);
  const limbP = (d) => strokeD(d, C.plum, 5.6) + strokeD(d, PK, 2.4);
  const WAD = 'M38 13Q54 10 63 21Q72 29 69 41Q75 51 68 60Q66 71 56 72Q47 78 38 75Q28 79 19 72Q8 67 10 54Q3 44 10 36Q7 27 16 21Q25 13 38 13Z';
  // taller / puffed-cheek wad for the tell
  const WAD_T = 'M38 7Q58 3 67 16Q76 24 73 38Q77 50 72 62Q68 74 58 75Q48 82 38 78Q27 82 17 74Q4 68 6 54Q3 44 6 34Q4 22 12 15Q22 6 38 7Z';
  const wad = (path) => flat(path, PK) + clipTo(path, flat('M58 28Q72 48 66 64Q58 78 40 80Q56 70 60 56Q62 42 58 28Z', PKD)) + flat('M17 29Q22 21 31 18Q25 27 24 39Z', PKL) + ln(path, 3);
  // gum wrapper worn as a bandana: silver foil, coral stripe, crinkle ticks, knot + two tails on the right. y = top edge of the band at the centre
  const bandana = (y, tilt = 0, limp = false) => {
    const top = y, bot = y + 10;
    const BAND = `M8 ${top + 5}Q39 ${top - 6} 70 ${top + 5}L70 ${bot + 4}Q39 ${bot - 7} 8 ${bot + 4}Z`;
    let s = `<g transform="rotate(${tilt} 39 ${y + 5})">` + flat(BAND, C.chrome);
    s += clipTo(BAND, ln(`M6 ${n(top + 9.6)}Q39 ${n(top - 1.4)} 72 ${n(top + 9.6)}`, 3.6, CO) + flat(`M8 ${bot + 4}Q39 ${bot - 7} 70 ${bot + 4}L70 ${bot + 6}L8 ${bot + 6}Z`, C.chromeD));
    s += ln(`M20 ${top + 1.5}L21.5 ${top + 7}M32 ${top - 0.5}L33 ${top + 4.5}M45 ${top - 0.5}L44 ${top + 4.5}M57 ${top + 1.5}L55.5 ${top + 7}`, 1.5, C.chromeD) + ln(BAND, 2.6);
    s += limp
      ? sh(`M68 ${top + 8}L74 ${top + 16}L70 ${top + 20}L66 ${top + 12}Z`, C.chrome, 2) + sh(`M66 ${top + 10}L71 ${top + 22}L64 ${top + 18}Z`, CO, 2)
      : sh(`M66 ${top + 8}L75.5 ${top + 1.5}L73.5 ${top + 8}L75.5 ${top + 14.5}Z`, C.chrome, 2) + sh(`M66 ${top + 9}L76 ${top + 18}L70 ${top + 20}Z`, CO, 2);
    return s + `<circle cx="67" cy="${top + 9}" r="3.4" fill="${CO}" stroke="${C.plum}" stroke-width="2.2"/></g>`;
  };
  // pink puddles on the floor (with a glossy glint); the strand is a stretched string from the left hand into the left puddle
  const puddle = (x, y, rx, ry = 3.8) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${PKD}" stroke="${C.plum}" stroke-width="2.2"/><ellipse cx="${n(x - rx * 0.3)}" cy="${y - 1}" rx="${n(rx * 0.3)}" ry="1.2" fill="${PKL}"/>`;
  const sticky = (strand, hx = 9, hy = 69) => {
    let s = puddle(14, 89.4, 11.5) + puddle(59, 89.6, 13, 3.6);
    // gum string stuck to the left hand, stretching down into the puddle, with a drip bulge at the end
    if (strand) s += limbP(`M${hx} ${hy}Q5 77 8.5 82Q10.5 85 10.5 86.5`) + `<circle cx="10.2" cy="86.4" r="3" fill="${PK}" stroke="${C.plum}" stroke-width="2"/><circle cx="9.3" cy="85.6" r=".9" fill="${PKL}"/>`;
    return s;
  };
  // bubble: r = radius, (cx, cy) centre; crack = about to pop
  const bubble = (cx, cy, r, crack = false) => {
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PKL}" fill-opacity=".92" stroke="${C.plum}" stroke-width="3"/>`;
    s += ln(`M${n(cx - r * 0.62)} ${n(cy - r * 0.12)}Q${n(cx - r * 0.55)} ${n(cy - r * 0.6)} ${n(cx - r * 0.1)} ${n(cy - r * 0.7)}`, Math.max(2, n(r * 0.16)), W);
    s += `<circle cx="${n(cx + r * 0.45)}" cy="${n(cy + r * 0.4)}" r="${n(r * 0.1)}" fill="${W}"/>`;
    if (crack) s += ln(`M${n(cx + r * 0.35)} ${n(cy - r * 0.9)}L${n(cx + r * 0.5)} ${n(cy - r * 0.55)}L${n(cx + r * 0.3)} ${n(cy - r * 0.45)}L${n(cx + r * 0.62)} ${n(cy - r * 0.1)}`, 2.2) + ln(`M${n(cx - r * 0.2)} ${n(cy + r * 0.8)}L${n(cx - r * 0.05)} ${n(cy + r * 0.55)}L${n(cx - r * 0.3)} ${n(cy + r * 0.45)}`, 2.2);
    return s;
  };
  const lips = (x, y, w = 4.6) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${n(w * 0.62)}" fill="${PKD}" stroke="${C.plum}" stroke-width="2.2"/><ellipse cx="${x}" cy="${y}" rx="${n(w * 0.38)}" ry="${n(w * 0.24)}" fill="${C.plum}"/>`;
  // sneaker soles rest on y = 87.4 + 2.7 (sole) + 1.1 (outline) = 91.2, the 0.95 x 96 ground line
  const FY = 87.4;
  let b = '';
  if (T) {
    b += sticky(false);
    b += limbP('M24 74L17 84') + sneaker(14, FY, -1, TE, 0.9) + limbP('M54 74L61 84') + sneaker(64, FY, 1, TE, 0.9);
    b += limbP('M9 44Q1 54 8 64') + mitt(14, 64, 4.4, 90, PK) + limbP('M69 44Q77 54 70 64') + mitt(64, 64, 4.4, -90, PK);
    b += wad(WAD_T);
    b += bandana(13, -2);
    b += ovalEye(27, 37, 7.2, 8.6, 0, 0, { pr: 2.6, sclera: CO, sw: 3 }) + ovalEye(51, 37, 7.2, 8.6, 0, 0, { pr: 2.6, sclera: CO, sw: 3 });
    b += ln('M15 26L33 31', 3.8) + ln('M63 26L45 31', 3.8);
    b += `<ellipse cx="14" cy="52" rx="5" ry="3.4" fill="${PKD}" opacity=".7"/><ellipse cx="64" cy="52" rx="5" ry="3.4" fill="${PKD}" opacity=".7"/>`;
    b += bubble(39, 66, 22, true) + lips(39, 46, 6);
    // tension ticks around the bubble, pop sparks
    b += ln('M11 80L4 84', 2.4, C.lav) + ln('M67 80L74 84', 2.4, C.lav) + ln('M60 50L69 44', 2.4, C.lav) + ln('M18 50L9 44', 2.4, C.lav);
    b += sh(star(70, 30, 5, 2.2, 4), C.gold, 1.6) + sh(star(7, 30, 4.5, 2, 4), C.gold, 1.6);
    return b;
  }
  if (H) {
    b += sticky(false);
    b += limbP('M28 73L24 84') + sneaker(21, FY, -1, TE, 0.9) + limbP('M52 73L56 84') + sneaker(59, FY, 1, TE, 0.9);
    let body = limbP('M13 48Q6 42 8 30') + mitt(8, 27, 4.4, 0, PK) + limbP('M65 48Q72 42 70 30') + mitt(70, 27, 4.4, 0, PK);
    body += wad(WAD) + bandana(22, 12, true);
    // squeezed > < eyes, worried brows
    body += ln('M20 38L31 44L20 50', 3.8) + ln('M58 38L47 44L58 50', 3.8);
    body += ln('M19 32L30 35', 2.8) + ln('M59 32L48 35', 2.8);
    // popped bubble: ragged film plastered over the lower face, wobbly "ow" under it
    const film = 'M14 52Q18 47 23 52Q28 46 33 51Q39 45 45 51Q51 46 56 52Q61 47 65 53Q70 61 64 67Q66 74 58 74Q54 70 49 74Q44 70 39 75Q34 70 29 74Q24 71 20 74Q12 73 15 66Q10 60 14 52Z';
    body += `<path d="${film}" fill="${PKL}" fill-opacity=".92" stroke="${C.plum}" stroke-width="2.6" stroke-linejoin="round"/>`;
    body += sh('M31 57Q33 53 36 55Q39 52 42 55Q45 53 47 57Q49 64 45 67Q42 70 39 68Q36 70 33 67Q29 64 31 57Z', C.plum, 2.2) + flat('M35 65Q39 60 43 65Q39 68 35 65Z', COL);
    body += ln('M24 56Q28 59 24 63', 2, W) + ln('M54 56Q50 59 54 63', 2, W);
    b += `<g transform="translate(3 0) translate(39 91) rotate(-3) scale(1.04 .94) translate(-39 -91)">${body}</g>`;
    // shreds + pop burst
    b += sh('M2 56L9 53L7 60Z', PKL, 1.8) + sh('M71 58L76 54L75.5 62Z', PKL, 1.8) + sh('M62 8L69 6L66 13Z', PKL, 1.8) + sh('M8 14L14 10L13 17Z', PKL, 1.8);
    b += sh(star(38, 7, 5, 2.2, 5), C.gold, 1.6) + drop(5, 42, 1) + drop(72, 44, 1);
    return b;
  }
  // idle (a) and walk (b): slouched, blowing a bubble, sticky puddle with drips. a plants the right foot with the left lifted; b swaps them.
  b += walkB ? sticky(true, 11, 65) : sticky(true);
  b += walkB ? limbP('M28 73L25 84') + sneaker(22, FY, -1, TE, 0.9) + limbP('M51 70Q55 72 55 75') + sneaker(57, 81, 1, TE, 0.9)
    : limbP('M51 73L55 84') + sneaker(58, FY, 1, TE, 0.9) + limbP('M28 70Q25 72 25 75') + sneaker(26, 81, -1, TE, 0.9);
  let t = walkB ? limbP('M13 48Q7 52 11 60') + mitt(11, 62, 4.4, 0, PK) + limbP('M66 48Q74 56 71.5 67') + mitt(71.5, 69, 4.4, 0, PK)
    : limbP('M13 48Q6 54 9 64') + mitt(9, 66, 4.4, 0, PK) + limbP('M66 48Q75 54 72 64') + mitt(72, 66, 4.4, 0, PK);
  t += wad(WAD) + bandana(23, -3);
  t += ovalEye(29, 44, 5.8, 7.2, 2, 0.6, { lid: 0.36, tilt: -8, lc: PK, pr: 3.4 }) + ovalEye(49, 44, 5.8, 7.2, 2, 0.6, { lid: 0.36, tilt: 8, lc: PK, pr: 3.4 });
  t += ln('M20 34L34 38.5', 3.2) + ln('M58 34L44 38.5', 3.2);
  t += `<ellipse cx="17" cy="54" rx="4" ry="2.8" fill="${PKD}" opacity=".6"/><ellipse cx="61" cy="54" rx="4" ry="2.8" fill="${PKD}" opacity=".6"/>`;
  t += bubble(39, 62, 13) + lips(39, 51, 4.4);
  return b + `<g transform="${walkB ? 'translate(0 -1.5) ' : ''}rotate(-3 39 85)">${t}</g>`;
}
add('enemy_gum_a', () => gum('a'));
add('enemy_gum_b', () => gum('b'));
add('enemy_gum_tell', () => gum('tell'));
add('enemy_gum_hurt', () => gum('hurt'));

// ---------- boss: the Store Manager, a possessed checkout register (food-limbed) ----------
const MGR_SCREEN = '#1E1028', MGR_TELL = '#4A1D2A';
const rrect = (x, y, w, h, r) => `M${x + r} ${y}L${x + w - r} ${y}Q${x + w} ${y} ${x + w} ${y + r}L${x + w} ${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}L${x + r} ${y + h}Q${x} ${y + h} ${x} ${y + h - r}L${x} ${y + r}Q${x} ${y} ${x + r} ${y}Z`;
const dot = (cx, cy, r, fill, w = 2.2) => `<circle cx="${cx}" cy="${cy}" r="${n(r)}" fill="${fill}" stroke="${C.plum}" stroke-width="${w}"/>`;
const clipTo = (d, inner) => { const id = `c${++uid}`; return `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${inner}</g>`; };
const coinAt = (x, y, r) => dot(x, y, r, C.gold, 1.8) + `<circle cx="${x}" cy="${y}" r="${n(r * 0.55)}" fill="none" stroke="${C.goldD}" stroke-width="1.4"/>`;
const keyRow = (x, y, k, step, w, h, off = 0) => Array.from({ length: k }, (_, i) => `<rect x="${x + i * step}" y="${y}" width="${w}" height="${h}" rx="1" fill="${[C.gold, C.coralL, C.cream, C.teal, C.lavL][(i + off) % 5]}"/>`).join('');
const ruled = (x, y, w, rows, step = 6) => Array.from({ length: rows }, (_, i) => line([[x, y + i * step], [x + w - (i % 3) * 3, y + i * step]], C.lavD, 1.3)).join('');
const sweat = (x, y, s = 1) => shape(`M${x} ${y}Q${n(x + 4 * s)} ${n(y + 5 * s)} ${x} ${n(y + 7 * s)}Q${n(x - 4 * s)} ${n(y + 5 * s)} ${x} ${y}Z`, C.sky, null, { sw: 1.8 });
const rays = (segs, col, w = 2.5) => segs.map(([x1, y1, x2, y2]) => line([[x1, y1], [x2, y2]], col, w)).join('');
const mgrTie = (x, y, deg) => `<g transform="translate(${x} ${y}) rotate(${deg})">` + shape('M-5 0L5 0L4 7L-4 7Z', C.teal, null, { sw: 2.2 }) +
  shape('M-4 7L4 7L8 27L0 33L-8 27Z', C.teal, C.tealD, { sw: 2.4, dx: 3, dy: 3 }) + line([[-3, 16], [4, 14]], C.tealD, 1.4) + line([[-5, 22], [6, 20]], C.tealD, 1.4) + `</g>`;

// Shared frame wrapper for the food-limbed bosses: per-frame squash, and the 5px drop because they are drawn on a y=185 ground while the sprite anchors at y=190.
const BOSS_SQUASH = { a: [1, 1], b: [0.99, 1.01], tell: [1.03, 0.97], hurt: [1.04, 0.96] };
function foodBoss(name, f, inner) {
  const sq = BOSS_SQUASH[f];
  if (!sq) throw new Error(`${name}: unknown frame "${f}"`);
  return squash(100, 190, sq[0], sq[1], `<g transform="translate(0 5)">${inner}</g>`);
}

function boss(f) {
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const scr = tell ? MGR_TELL : MGR_SCREEN, hd = { a: 4, b: 4, tell: -3, hurt: -4 }[f];
  const [cdx, cdy, cdeg] = { a: [0, 2, -9], b: [3, -5, -4], tell: [4, -38, -24], hurt: [2, 2, -18] }[f];
  const [mx, my] = { a: [166, 78], b: [170, 92], tell: [168, 54], hurt: [168, 60] }[f];

  // feet: planted ones sit on y=185, which the +5 shift below puts on the 190 ground line
  const feet = {
    a: [['M88 148Q82 164 84 178', 86, 185, -1], ['M112 148Q126 158 124 171', 126, 178, 1]],
    b: [['M88 148Q74 158 76 171', 78, 178, -1], ['M112 148Q122 164 118 178', 116, 185, 1]],
    tell: [['M88 148Q76 164 78 178', 80, 185, -1], ['M112 148Q126 164 124 178', 122, 185, 1]],
    hurt: [['M88 148Q78 162 76 178', 78, 185, -1], ['M112 148Q128 160 130 172', 132, 179, 1]],
  }[f].map(([d, x, y, dir]) => nub(x, y, dir, C.coral, 1.8) + limb(d, C.coral, 9) + nub(x, y, dir, C.coral, 1.8)).join('');

  const clipboard = `<g transform="translate(${cdx} ${cdy}) rotate(${cdeg} 52 138)">` +
    (hurt ? '' : shape('M24 154L34 154C36 162 30 168 34 176L28 173L22 177L18 171C20 164 22 160 24 154Z', C.cream, null, { sw: 2.2 }) + ruled(24, 160, 8, 3)) +
    shape(rrect(14, 110, 40, 50, 4), C.bread, C.breadD, { sw: 3, dx: 4, dy: 4 }) +
    (hurt ? shape('M20 118L48 118L48 124L43 121L37 125L31 121L25 125L20 122Z', C.cream, null, { sw: 1.6 })
      : `<path d="${rrect(19, 118, 30, 37, 2)}" fill="${C.cream}" stroke="${C.plum}" stroke-width="1.6"/>` +
        [0, 1, 2, 3].map((i) => `<rect x="22" y="${123 + i * 8}" width="4" height="4" fill="${C.white}" stroke="${C.plum}" stroke-width="1.1"/>` + line([[29, 125 + i * 8], [45 - (i % 2) * 5, 125 + i * 8]], C.lavD, 1.4)).join('') +
        line([[22.5, 125], [24, 127], [27, 121.5]], C.coral, 1.6) + line([[22.5, 133], [24, 135], [27, 129.5]], C.coral, 1.6)) +
    shape(rrect(26, 105, 16, 9, 2), C.chrome, null, { sw: 2.2 }) + `</g>`;

  let up = limb(`M68 116Q${46 + cdx} ${118 + cdy / 2} ${50 + cdx} ${138 + cdy}`, C.coral, 9);
  // torso, key deck, cash drawer belly, tie
  up += shape(rrect(64, 106, 72, 50, 10), C.coral, C.coralD, { sw: 4, dx: 5, dy: 5 });
  up += shape('M68 92L132 92L141 108L59 108Z', C.plumSoft, null, { sw: 3 }) + keyRow(70, 95, 7, 9, 6.5, 3.5, 1) + keyRow(65, 101, 7, 9.6, 7.5, 3.5, 3);
  up += shape(rrect(76, 134, 48, 16, 4), C.chrome, C.chromeD, { sw: 2.6, dx: 3, dy: 3 }) + line([[92, 142], [108, 142]], C.plum, 3) + coinAt(117, 142, 4);
  up += mgrTie(100, 98, { a: 3, b: -3, tell: -8, hurt: 14 }[f]);
  up += clipboard + mitt(52 + cdx, 138 + cdy, 8, 5, C.coral);
  // raised arm with wrist watch
  up += limb(`M134 116Q${mx + 6} 116 ${mx} ${my + 10}`, C.coral, 9);
  up += line([[mx - 6, my + 18], [mx + 6, my + 16]], C.plum, 3.6) + dot(mx, my + 17, 5.4, C.chrome, 2) + line([[mx, my + 17], [mx, my + 13.5]], C.plum, 1.3) + line([[mx, my + 17], [mx + 2.6, my + 18.5]], C.plum, 1.3);
  up += mitt(mx, my, tell ? 10 : 9, tell ? -10 : 10, C.coral);
  if (!tell && !hurt) up += rays([[mx + 13, my - 6, mx + 19, my - 10], [mx + 15, my + 4, mx + 22, my + 4], [mx + 10, my - 14, mx + 14, my - 20]], C.lav);

  // head: the screen
  let h = shape(rrect(52, 14, 96, 78, 14), C.coral, C.coralD, { sw: 4, dx: 6, dy: 6 }) + flat(rrect(58, 18, 18, 4, 2), C.coralL);
  h += `<path d="${rrect(59, 21, 82, 64, 8)}" fill="${scr}" stroke="${C.plum}" stroke-width="2.5"/>` + flat('M63 25L82 25L63 44Z', C.white, 'opacity=".12"');
  if (hurt) {
    h += line([[80, 35], [96, 46], [80, 57]], C.cream, 4.2) + line([[120, 35], [104, 46], [120, 57]], C.cream, 4.2);
    const ow = 'M86 68Q84 60 92 60Q98 56 104 60Q110 56 116 60Q124 60 122 68Q127 76 119 80Q113 85 104 81Q95 85 89 80Q81 76 86 68Z';
    h += shape(ow, C.chrome, null, { sw: 2.4 }) + `<path d="${ow}" fill="${MGR_TELL}" transform="translate(104 70) scale(0.62) translate(-104 -70)"/>`;
  } else if (tell) {
    const eyeCol = '#FF9A82';
    h += ovalEye(87, 46, 10, 14, 4, 3, { sclera: eyeCol, lid: 0.36, tilt: 15, lc: scr }) + ovalEye(113, 46, 10, 14, -4, 3, { sclera: eyeCol, lid: 0.36, tilt: -15, lc: scr });
    h += strokeD('M72 24Q86 26 99 37', C.cream, 3.8) + strokeD('M128 24Q114 26 101 37', C.cream, 3.8);
    const mo = rrect(87, 65, 36, 22, 8);
    h += shape(rrect(82, 61, 46, 30, 12), C.chrome, null, { sw: 2.6 }) + `<path d="${mo}" fill="${MGR_SCREEN}"/>`;
    h += clipTo(mo, [91, 99, 107, 115, 122].map((x) => coinAt(x, 65, 4)).join('') + [95, 103, 111, 119].map((x) => coinAt(x, 87, 3.6)).join('') + ell(105, 86, 9, 6, C.coralL, null, { sw: 1.8 }));
    h += `<path d="${mo}" fill="none" stroke="${C.plum}" stroke-width="2.2"/>`;
  } else {
    h += ovalEye(87, 46, 10, 14, 5.5, 1.5, { lid: 0.3, tilt: 6, lc: scr }) + ovalEye(113, 46, 10, 14, 5.5, 1.5, { lid: 0.22, tilt: -4, lc: scr });
    h += strokeD('M76 27Q86 23 97 29', C.cream, 3.2) + strokeD('M105 25Q118 15 128 22', C.cream, 3.2);
    const mo = 'M91 66L117 66L117 70Q117 74 113 74L95 74Q91 74 91 70Z';
    h += shape(rrect(88, 63, 32, 14, 6), C.chrome, null, { sw: 2.4 }) + `<path d="${mo}" fill="${MGR_TELL}"/>` + clipTo(mo, [95, 101.5, 108, 114.5].map((x) => coinAt(x, 66, 3.4)).join(''));
    h += ell(104, 80, 11, 4.6, C.chrome, null, { sw: 2.2 }) + flat('M96 79Q99 77 104 77', C.chromeL) + strokeD('M121 64Q125 66 123 71', C.plum, 1.8);
  }
  up += rot(h, hd, 100, 94);

  // headset with a mic boom; the hit knocks it askew
  let hs = limb('M52 42C50 -2 150 -2 148 42', C.chrome, 7);
  hs += ell(50, 52, 8, 13, C.chromeD, null, { sw: 2.6 }) + ell(47.5, 52, 4.6, 8.5, C.teal, null, { sw: 1.8 });
  hs += ell(150, 52, 8, 13, C.chromeD, null, { sw: 2.6 }) + ell(152.5, 52, 4.6, 8.5, C.teal, null, { sw: 1.8 });
  hs += limb('M48 64Q44 90 66 86Q76 85 80 78', C.chromeD, 5) + dot(82, 76, 5, C.plumSoft, 2.2) + `<circle cx="80.6" cy="74.6" r="1.6" fill="${C.lavL}"/>`;
  up += rot(hurt ? `<g transform="translate(-8 -2)">${rot(hs, -20, 100, 40)}</g>` : hs, hd, 100, 94);

  up = `<g transform="translate(0 ${walkB ? -2 : 0})">${up}</g>`;
  if (hurt) up = rot(up, -8, 100, 156);

  let fx = '';
  if (tell) {
    fx += spark(26, 30, 11) + spark(176, 26, 11);
    fx += rays([[42, 52, 30, 46], [40, 66, 28, 68], [44, 38, 36, 28]], C.coral, 3) + rays([[158, 40, 170, 34], [160, 56, 172, 56]], C.coral, 3);
  }
  if (hurt) {
    fx += `<g transform="rotate(-26 30 108)">` + shape(rrect(16, 92, 28, 34, 2), C.cream, null, { sw: 2.2 }) + ruled(20, 100, 18, 4, 6) + `</g>`;
    fx += rays([[48, 112, 58, 116], [46, 122, 54, 128], [48, 100, 56, 100]], C.lav);
    fx += sweat(44, 36, 1.7) + sweat(34, 52, 1.4) + sweat(152, 30, 1.5);
    fx += shape(star(160, 12, 8, 3, 4), C.gold, null, { sw: 1.6 });
  }
  return foodBoss('boss', f, `${feet}${up}${fx}`);
}
add('boss_a', () => boss('a'));
add('boss_b', () => boss('b'));
add('boss_tell', () => boss('tell'));
add('boss_hurt', () => boss('hurt'));

// ---------- per-theme bosses (aisle 8): same 200x200 frame and foodBoss wrapper as the Manager, a/b walk + tell + hurt ----------

// Walk-In Freezer (frozen): drawn on the y=185 ground like the Manager; foodBoss shifts it onto the sprite's 190 line.
function bossFrozen(f) {
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const INSIDE = '#4A1D2A', EYE_TELL = '#FF9A82';
  const mir = (cx, s) => `<g transform="translate(${2 * cx} 0) scale(-1 1)">${s}</g>`;
  const icicle = (x, y, w, len, lean = 0) => {
    const d = `M${x - w / 2} ${y}L${x + w / 2} ${y}L${x + lean} ${y + len}Z`;
    return flat(d, C.white) + flat(`M${x + w * 0.08} ${y}L${x + w / 2} ${y}L${x + lean} ${y + len}Z`, C.frostD) + strokeD(d, C.plum, 2);
  };
  const fang = (x0, x1, y, len) => shape(`M${x0} ${y}L${x1} ${y}L${(x0 + x1) / 2} ${y + len}Z`, C.white, null, { sw: 1.2 });
  const gape = (d, inner, w = 2.2) => `<path d="${d}" fill="${INSIDE}"/>` + clipTo(d, inner) + `<path d="${d}" fill="none" stroke="${C.plum}" stroke-width="${w}" stroke-linejoin="round"/>`;
  // one merged outline over overlapping circles
  const cloud = (parts) => parts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 1.3}" fill="${C.plum}"/>`).join('') +
    parts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.white}"/>`).join('') +
    parts.map(([x, y, r]) => strokeD(`M${n(x - r * 0.6)} ${n(y + r * 0.25)}Q${n(x - r * 0.55)} ${n(y - r * 0.5)} ${n(x + r * 0.1)} ${n(y - r * 0.62)}`, C.frostD, 1.8)).join('');

  const legs = {
    a: [['M86 148Q85 166 81 178', 82, 185, -1], ['M110 148Q122 156 126 168', 128, 175, 1]],
    b: [['M86 148Q74 156 72 168', 70, 175, -1], ['M110 148Q112 166 116 178', 117, 185, 1]],
    tell: [['M86 148Q78 166 74 178', 75, 185, -1], ['M110 148Q118 166 124 178', 125, 185, 1]],
    hurt: [['M86 148Q80 164 70 176', 71, 185, -1], ['M110 148Q124 156 130 164', 132, 172, 1]],
  }[f].map(([d, x, y, dir]) => limb(d, C.frost, 9) + nub(x, y, dir, C.frost, 1.8)).join('');

  const lowL = limb('M60 112Q42 116 38 138', C.frost, 9) + mir(38, mitt(38, 142, 9.5, 0, C.frost));
  const highR = limb('M140 104Q170 108 174 88', C.frost, 9) + mitt(174, 82, 10, 10, C.frost);
  const upL = limb('M60 108Q32 112 30 86', C.frost, 9) + mir(30, mitt(30, 80, 11, 0, C.frost));
  const arms = { a: mir(100, lowL + highR), b: lowL + highR, tell: upL + mir(100, upL),
    hurt: limb('M60 112Q40 116 28 134', C.frost, 9) + mir(28, mitt(28, 138, 9.5, 20, C.frost)) + limb('M140 104Q168 104 168 80', C.frost, 9) + mitt(168, 74, 10, 25, C.frost) }[f];

  let up = arms;
  up += shape(rrect(60, 44, 80, 108, 12), C.frost, C.frostD, { sw: 4, dx: 6, dy: 6 });
  up += shape(rrect(66, 52, 58, 94, 8), C.white, C.frost, { sw: 2.6, dx: 4, dy: 4 });
  up += shape(rrect(128, 84, 7, 36, 3.5), C.chrome, null, { sw: 2.4 }) + strokeD('M131 89L131 112', C.chromeL, 1.6);

  if (hurt) {
    up += strokeD('M77 65L91 76L77 87', C.plum, 4.6) + strokeD('M113 65L99 76L113 87', C.plum, 4.6);
    const ow = 'M82 98Q85 92 90 97Q95 91 100 97Q105 92 108 98Q112 108 103 113Q95 119 87 113Q78 108 82 98Z';
    up += gape(ow, ell(95, 116, 9, 5.5, C.coralL, null, { sw: 1.6 }) + fang(86, 91, 95, 6), 2.4);
  } else if (tell) {
    up += ovalEye(84, 76, 9.5, 14, 3, 2, { sclera: EYE_TELL, lid: 0.38, tilt: 14, lc: C.frost, pr: 5 }) + ovalEye(106, 76, 9.5, 14, -3, 2, { sclera: EYE_TELL, lid: 0.38, tilt: -14, lc: C.frost, pr: 5 });
    up += strokeD('M70 61Q84 60 96 69', C.plum, 4) + strokeD('M120 61Q106 60 94 69', C.plum, 4);
    const mo = 'M81 97Q95 90 109 97Q113 115 95 116Q77 115 81 97Z';
    const teeth = [0, 1, 2, 3].map((i) => fang(82 + i * 6.6, 88.6 + i * 6.6, 91, 10 + (i % 2) * 3)).join('') + [0, 1, 2].map((i) => fang(85 + i * 7.5, 92.5 + i * 7.5, 118, -8)).join('');
    up += gape(mo, `<ellipse cx="95" cy="107" rx="10" ry="7" fill="${C.sky}"/><ellipse cx="95" cy="107" rx="5" ry="3.6" fill="${C.frost}"/>` + teeth, 2.4);
  } else {
    up += ovalEye(84, 76, 9.5, 14, -4.5, 3, { lid: 0.34, lc: C.frost, pr: 5.4 }) + ovalEye(106, 76, 9.5, 14, -4.5, 3, { lid: 0.34, lc: C.frost, pr: 5.4 });
    up += gape('M88 101Q95 98 102 101Q103 109 95 110Q87 109 88 101Z', fang(89.5, 93.5, 98, 6) + fang(96.5, 100.5, 98, 6));
    up += ell(95, 111.5, 7.5, 3.8, C.coralL, null, { sw: 2 }) + flat('M90 110.5Q93 109.5 96 110.5', C.white, 'opacity=".7"');
  }

  up += shape(rrect(54, 118, 92, 14, 6), C.coral, C.coralD, { sw: 3, dx: 3, dy: 3 });
  up += [66, 80, 94, 108, 122, 136].map((x) => strokeD(`M${x} 120L${x} 130`, C.cream, 3)).join('');
  if (hurt) {
    const fl = 'M128 126Q150 112 176 122L174 138Q150 130 128 142Z';
    up += shape(fl, C.coral, C.coralD, { sw: 3, dx: 3, dy: 3 }) + strokeD('M144 120L143 136M158 122L157 134', C.cream, 3);
    up += [128, 134].map((y) => strokeD(`M176 ${y - 4 + (y - 128) * 0.1}L184 ${y - 7}`, C.plum, 3.8) + strokeD(`M176 ${y - 4 + (y - 128) * 0.1}L184 ${y - 7}`, C.coral, 1.6)).join('');
  } else {
    up += `<g transform="rotate(-5 128 130)">${shape(rrect(121, 126, 16, 34, 3), C.coral, C.coralD, { sw: 3, dx: 3, dy: 3 })}${strokeD('M123 137L135 137M123 147L135 147', C.cream, 3)}` +
      [124, 129, 134].map((x) => strokeD(`M${x} 160L${x} 166`, C.plum, 3.8) + strokeD(`M${x} 160L${x} 166`, C.coral, 1.6)).join('') + `</g>`;
  }

  up += shape('M64 24L136 24L146 50L54 50Z', C.chrome, C.chromeD, { sw: 3.5, dx: 5, dy: 5 }) + strokeD('M67 27.2L133 27.2', C.chromeL, 2);
  for (let i = 0; i < 3; i++) {
    const t = 0.4 + i * 0.2, y = 24 + 26 * t, xl = 54 + 10 * (1 - t) + 8, xr = 146 - 10 * (1 - t) - 16;
    up += strokeD(`M${n(xl)} ${n(y)}L${n(xr)} ${n(y)}`, C.chromeD, 3) + strokeD(`M${n(xl)} ${n(y + 2.4)}L${n(xr)} ${n(y + 2.4)}`, C.chromeL, 1.2);
  }
  if (tell) up += `<circle cx="134" cy="38" r="8" fill="${C.coral}" opacity=".4"/>`;
  up += dot(134, 38, 3.4, tell ? C.coral : C.teal, 1.8) + `<circle cx="133" cy="37" r="1" fill="${C.white}"/>`;
  // the hit snaps the left icicle off (the shard is drawn falling in fx)
  const ics = [[70, 7, hurt ? 2 : 8], [82, 8, 11, -1], [98, 7, 7], [112, 9, 12, 1], [124, 7, 8]];
  up += ics.map(([x, w, len, lean]) => icicle(x, 50, w, len + (tell ? 4 : 0), lean ?? 0)).join('');

  // the band is drawn over the cap; the hit knocks it askew
  let em = limb('M51 70L51 42Q51 21 72 21L128 21Q149 21 149 42L149 70', C.chromeD, 6.5);
  for (const px of [51, 149]) {
    for (let i = 0; i < 9; i++) { const a = (i * Math.PI * 2) / 9; em += dot(n(px + Math.cos(a) * 9), n(70 + Math.sin(a) * 9), 3.6, C.coral, 1.8); }
    em += `<circle cx="${px}" cy="70" r="9" fill="${C.coral}"/>` + strokeD(`M${px - 5} 66Q${px - 2} 62 ${px + 2} 62`, C.coralL, 2);
  }
  up += hurt ? `<g transform="translate(3 -5)">${rot(em, -11, 100, 44)}</g>` : em;

  up = `<g transform="translate(0 ${walkB ? -2 : 0})">${up}</g>`;
  if (hurt) up = rot(up, -6, 100, 156);
  else if (tell) up = rot(up, -4, 100, 156);

  let fx = '';
  if (tell) {
    fx += spark(24, 36, 11, C.sky) + spark(176, 34, 11, C.sky);
    const cl = [[32, 148, 9], [20, 137, 6.5], [40, 158, 5.5]];
    fx += cloud(cl) + cloud(cl.map(([x, y, r]) => [200 - x, y, r]));
    fx += snowflake(40, 114, 6, C.sky, 1.8) + snowflake(160, 114, 6, C.sky, 1.8);
    fx += shape(star(50, 12, 6, 2, 4), C.sky, null, { sw: 1.6 }) + shape(star(150, 10, 6, 2, 4), C.sky, null, { sw: 1.6 });
  }
  if (hurt) {
    fx += `<g transform="translate(34 100) rotate(22)">${icicle(0, 0, 10, 24, 0.5)}</g>` + rays([[26, 78, 30, 90], [36, 80, 38, 90]], C.lav);
    fx += sweat(40, 34, 1.5) + sweat(30, 52, 1.3) + sweat(166, 30, 1.4);
    fx += sweat(152, 166, 1.1) + sweat(58, 160, 1.2) + shape('M22 116L27 112L25 119Z', C.white, null, { sw: 1.4 }) + shape('M44 104L49 108L43 110Z', C.white, null, { sw: 1.4 });
    fx += shape(star(160, 12, 8, 3, 4), C.sky, null, { sw: 1.6 });
  }
  return foodBoss('boss_frozen', f, `${legs}${up}${fx}`);
}
add('boss_frozen_a', () => bossFrozen('a'));
add('boss_frozen_b', () => bossFrozen('b'));
add('boss_frozen_tell', () => bossFrozen('tell'));
add('boss_frozen_hurt', () => bossFrozen('hurt'));

// Industrial Oven (bakery): a slim brick oven on bread noodle limbs, chef's toque, glowing door window, handlebar moustache.
const bakeryPanel = (x, y, w, h, r, fill, dark, light, sw = 3, sd = 8) =>
  shape(rrect(x, y, w, h, r), fill, dark, { sw, dx: sd, dy: sd }) +
  (light && h - r - sd > 4 ? flat(rrect(x + sw / 2 + 0.5, y + r, sd * 0.5, h - r - sd - 1, 1), light) : '');
const bakeryBricks = (x, y, w, h) => {
  let d = '';
  for (let i = 0; i * 11 < h; i++) {
    const y0 = y + i * 11, y1 = Math.min(y0 + 11, y + h);
    if (i) d += `M${x} ${y0}L${x + w} ${y0}`;
    for (let v = x + (i % 2 ? 11 : 22); v < x + w - 1; v += 22) d += `M${v} ${y0}L${v} ${y1}`;
  }
  return strokeD(d, C.breadD, 1.2);
};
const bakeryDial = (x, y, r) => dot(x, y, r, C.gold, 2) + strokeD(`M${x} ${y}L${n(x + r * 0.5)} ${n(y - r * 0.55)}`, C.plum, 1.5);
const bakerySmoke = (pts, col = C.lavL) => pts.map(([x, y, r]) => dot(x, y, r, col, 2.2) + `<circle cx="${n(x - r * 0.38)}" cy="${n(y - r * 0.38)}" r="${n(r * 0.26)}" fill="${C.white}" opacity=".8"/>`).join('');
const bakeryBaguette = (cx, cy, L, deg, w = 12) => {
  const h = w / 2, a = -L / 2, b = L / 2, k = Math.max(3, Math.round(L / 13));
  const d = `M${a + h} ${-h}L${b - h} ${-h}A${h} ${h} 0 0 1 ${b - h} ${h}L${a + h} ${h}A${h} ${h} 0 0 1 ${a + h} ${-h}Z`;
  let cuts = '';
  for (let i = 0; i < k; i++) { const x = a + 9 + (i * (L - 18)) / (k - 1); cuts += `M${n(x - 2.6)} ${-h * 0.5}L${n(x + 2.6)} ${h * 0.5}`; }
  return `<g transform="translate(${cx} ${cy}) rotate(${deg})">${shape(d, C.breadL, C.bread, { sw: 2.8, dx: 0, dy: 2.4 })}${strokeD(cuts, C.breadD, 2)}</g>`;
};
const bakeryFlame = (x, y, s, deg = 0) => `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s})">` +
  shape('M0 0Q-8 -4 -6 -13Q-3 -10 -2 -10Q-5 -18 1 -25Q2 -16 7 -12Q10 -5 0 0Z', C.coral, null, { sw: 2 / s }) +
  flat('M0 -1Q-4 -4 -2.5 -9Q0 -7 1 -10Q5 -5 0 -1Z', C.gold) + `</g>`;
// one dark cloud: the plum stroke goes under every lobe, so only the outer rim shows
const bakerySoot = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.plum}" stroke="${C.plum}" stroke-width="5"/>`).join('') +
  pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.plumSoft}"/><circle cx="${n(x - r * 0.4)}" cy="${n(y - r * 0.4)}" r="${n(r * 0.28)}" fill="${C.lavD}"/>`).join('');
// (x, y) is where the hand grips it
const bakeryPin = (x, y, deg) => `<g transform="translate(${x} ${y}) rotate(${deg}) translate(0 -14)">` +
  shape(rrect(-4, -22, 8, 8, 2), C.bread, null, { sw: 2.2 }) + shape(rrect(-4, 14, 8, 8, 2), C.bread, null, { sw: 2.2 }) +
  shape(rrect(-7, -16, 14, 32, 5), C.creamD, null, { sw: 2.6 }) + flat('M-4.5 -12L-2.2 -12L-2.2 12L-4.5 12Z', C.cream) + `</g>`;
// union-outline trick: the plum stroke is drawn under all four lobes so they read as one hat
const bakeryToque = (dx = 0, dy = 0, deg = -6) => {
  const lobes = '<circle cx="88" cy="31" r="9"/><circle cx="100" cy="24" r="10"/><circle cx="112" cy="31" r="9"/><rect x="88" y="31" width="24" height="14"/>';
  return `<g transform="translate(${dx} ${dy}) rotate(${deg} 100 50)"><g stroke="${C.plum}" stroke-width="5.6" stroke-linejoin="round" fill="${C.white}">${lobes}</g><g fill="${C.white}">${lobes}</g>` +
    flat('M104 31Q116 29 114 40L112 44L106 44Z', C.cream) + strokeD('M94 36L94 44M100 34L100 44M106 36L106 44', C.creamD, 1.6) +
    bakeryPanel(86, 43, 28, 9, 2, C.white, C.cream, null, 2.8, 3) + `</g>`;
};

function bossBakery(f) {
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const MOUTH = '#4A1D2A';
  const glow = tell ? C.coral : C.gold, glowD = tell ? C.coralD : C.goldD, glowL = tell ? C.coralL : C.bananaL;

  // planted feet sit on y=185, which foodBoss drops onto the 190 ground line
  const feet = {
    a: [['M88 150Q93 166 86 180', 88, 185, -1], ['M112 150Q121 160 121 172', 119, 178, 1]],
    b: [['M88 150Q79 160 79 172', 81, 178, -1], ['M112 150Q107 166 114 180', 112, 185, 1]],
    tell: [['M88 150Q80 166 80 180', 82, 185, -1], ['M112 150Q120 166 120 180', 118, 185, 1]],
    hurt: [['M88 150Q80 164 79 180', 81, 185, -1], ['M112 150Q126 158 130 170', 128, 177, 1]],
  }[f].map(([d, x, y, dir]) => limb(d, C.bread, 9) + nub(x, y, dir, C.bread, 1.8)).join('');

  // [hip arm path, hand x, y, deg], [raised arm path, grip x, y, pin deg]
  const [hipArm, hipHand, pinArm, grip] = {
    a: ['M65 92Q40 98 48 116Q50 127 59 130', [59, 131, 20], 'M135 94Q160 92 162 70', [162, 66, 30]],
    b: ['M65 92Q54 98 59 111Q62 120 67 122', [67, 123, 20], 'M135 94Q152 100 156 86', [156, 82, 44]],
    tell: ['M65 92Q36 90 40 114', [40, 117, 10], 'M135 94Q162 96 156 56', [156, 54, 12]],
    hurt: ['M65 92Q40 82 33 98', [32, 102, -20], 'M135 96Q156 104 160 120', [161, 124, 30]],
  }[f];
  const smoke = {
    a: bakerySmoke([[68, 18, 5.5], [59, 10, 6.3], [47, 13, 5]]),
    b: bakerySmoke([[67, 16, 6], [56, 8.5, 6.8], [44, 9, 5.4]]),
    tell: bakerySmoke([[68, 17, 6.5], [58, 8, 7.5], [45, 11, 6], [34, 20, 4.5]]),
    hurt: bakerySoot([[66, 15, 7], [52, 9, 8.5], [38, 15, 7], [57, 23, 5]]),
  }[f];

  let up = limb(hipArm, C.bread, 9) + limb(pinArm, C.bread, 9);
  up += smoke + bakeryPanel(62, 28, 12, 26, 2, C.chrome, C.chromeD, C.chromeL, 3, 5) + bakeryPanel(58, 23, 20, 9, 3, C.chrome, C.chromeD, C.chromeL, 3, 4);
  up += bakeryPanel(64, 58, 72, 92, 8, C.bread, C.breadD, C.breadL, 4, 8) + bakeryBricks(68, 62, 64, 84);
  up += shape(rrect(60, 147, 80, 11, 4), C.plum, null, { sw: 3 }) + strokeD('M66 150.6L134 150.6', C.plumSoft, 1.6);
  if (tell) up += bakeryFlame(77, 149, 0.95) + bakeryFlame(123, 149, 0.95);
  up += bakeryBaguette(137, 44, 42, hurt ? 4 : -10, 11);
  up += bakeryPanel(58, 50, 84, 13, 4, C.chrome, C.chromeD, C.chromeL, 3, 4) + [70, 82, 118, 130].map((x) => bakeryDial(x, 56.5, 3.8)).join('');
  up += tell ? bakeryToque(0, -4, -12) : hurt ? bakeryToque(12, -10, 26) : bakeryToque();
  up += bakeryPanel(70, 65, 60, 40, 8, C.chrome, C.chromeD, C.chromeL, 3, 4) + bakeryPanel(74, 69, 52, 32, 5, glow, glowD, glowL, 2.2, 6);
  if (hurt) {
    up += strokeD('M83 74L96 85L83 96', C.plum, 4.2) + strokeD('M117 74L104 85L117 96', C.plum, 4.2);
  } else if (tell) {
    up += ovalEye(89, 85, 9.5, 14, 1.5, 2, { pr: 4.2, sclera: '#FFC4B0', lid: 0.4, tilt: 20, lc: glow }) + ovalEye(111, 85, 9.5, 14, -1.5, 2, { pr: 4.2, sclera: '#FFC4B0', lid: 0.4, tilt: -20, lc: glow });
  } else {
    up += ovalEye(89, 85, 9.5, 14, 4, 1, { pr: 5.4, lid: 0.28, tilt: 14, lc: glow }) + ovalEye(111, 85, 9.5, 14, 4, 1, { pr: 5.4, lid: 0.28, tilt: -14, lc: glow });
  }
  const mu = hurt ? 'M1 1C8 3 14 5 18 10Q20 13 18 15' : tell ? 'M1 1C8 4 17 4 23 -2Q28 -7 26 -11Q23 -12 22 -9' : 'M1 1C8 5 17 5 23 0Q28 -5 25 -9Q22 -11 21 -8';
  up += `<g transform="translate(100 ${tell ? 112 : hurt ? 112 : 114}) scale(1.1)">${strokeD(mu, C.plum, 5.6)}<g transform="scale(-1 1)">${strokeD(mu, C.plum, 5.6)}</g><ellipse cx="0" cy="1.2" rx="4.6" ry="3.6" fill="${C.plum}"/></g>`;
  if (tell) {
    const mo = 'M85 121Q100 117 115 121Q119 133 112 140Q100 145 88 140Q81 133 85 121Z';
    up += `<path d="${mo}" fill="${MOUTH}"/>` + clipTo(mo, flat(rrect(89, 117, 10, 8, 1), C.white) + flat(rrect(101, 117, 10, 8, 1), C.white) + ell(100, 143, 11, 6, C.coral, null, { sw: 1.8 })) +
      `<path d="${mo}" fill="none" stroke="${C.plum}" stroke-width="2.4" stroke-linejoin="round"/>`;
  } else if (hurt) {
    up += shape('M91 126Q89 123 94 124Q100 121 106 124Q111 123 109 128Q113 133 108 136Q104 141 100 138Q95 141 92 136Q87 133 91 126Z', MOUTH, null, { sw: 2 }) + clipTo('M95 138Q100 130 105 138Z', ell(100, 139, 6, 5, C.coral, null, { sw: 1 }));
  } else {
    up += shape('M91 125Q100 121 109 125Q108 130 100 130Q92 130 91 125Z', MOUTH, null, { sw: 2 }) + shape('M92 130.5Q100 135 108 130.5Q105 137 100 137Q95 137 92 130.5Z', C.coralL, null, { sw: 1.8 });
  }
  if (!tell && !hurt) up += shape(rrect(78, 140, 44, 5, 2.5), C.chrome, null, { sw: 2.2 });
  up += mitt(hipHand[0], hipHand[1], tell ? 10 : 8.5, hipHand[2], C.bread);
  up += (hurt ? bakeryPin(160, 56, 72) : bakeryPin(grip[0], grip[1], grip[2])) + mitt(grip[0], grip[1], tell ? 10 : 8.5, 20, C.bread);

  if (hurt) up += rays([[138, 68, 148, 64], [142, 77, 154, 71]], C.lav);
  up = `<g transform="translate(0 ${walkB ? -2 : 0})">${up}</g>`;
  if (hurt) up = rot(up, -8, 100, 156);

  let fx = '';
  if (tell) {
    fx += spark(24, 34, 11) + spark(181, 32, 10);
    fx += rays([[44, 60, 32, 54], [42, 76, 30, 78]], C.coral, 3) + rays([[170, 62, 182, 58], [168, 80, 180, 82]], C.coral, 3);
  }
  if (hurt) {
    fx += sweat(46, 52, 1.6) + sweat(40, 70, 1.3) + sweat(150, 66, 1.4);
    fx += shape(star(156, 14, 8, 3, 4), C.gold, null, { sw: 1.6 });
    fx += dot(26, 20, 2.6, C.plumSoft, 1.6) + dot(30, 33, 2, C.plumSoft, 1.4);
  }
  return foodBoss('boss_bakery', f, `${feet}${up}${fx}`);
}
add('boss_bakery_a', () => bossBakery('a'));
add('boss_bakery_b', () => bossBakery('b'));
add('boss_bakery_tell', () => bossBakery('tell'));
add('boss_bakery_hurt', () => bossBakery('hurt'));

// Smart-TV Wall (electronics, food-limbed): a big face-TV on a plum chassis, lav noodle limbs, a remote held up like a wand.
function bossElectronics(f) {
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const SCR = '#14213D', RED = '#4A1D2A';
  const limbCol = C.lav; // plumSoft limbs vanish into the plum outline on the mint floor
  const slab = (x, y, w, h, r, fill, dark, sw = 3, off = 3) => shape(rrect(x, y, w, h, r), fill, dark, { sw, dx: off, dy: off });
  const bars = (x, base, w, hs, gap = 1.2) => {
    const bw = (w - gap * (hs.length - 1)) / hs.length;
    return hs.map((bh, i) => `<rect x="${n(x + i * (bw + gap))}" y="${n(base - bh)}" width="${n(bw)}" height="${bh}" fill="${[C.coral, C.gold, C.teal, C.sky][i % 4]}"/>`).join('');
  };
  const noise = (seed, cols) => (ix, iy, iw, ih) => {
    const r = rng(seed);
    return Array.from({ length: 10 }, (_, i) => `<rect x="${n(ix + 1 + r() * (iw - 5))}" y="${n(iy + 1 + r() * (ih - 5))}" width="3" height="3" fill="${cols[i % cols.length]}"/>`).join('');
  };
  // small TV: blue shell, dark glass, content painted by inner(ix, iy, iw, ih)
  const stv = (x, y, w, h, inner, glass = SCR) => {
    const ix = x + 3.5, iy = y + 3.5, iw = w - 7, ih = h - 8;
    return slab(x, y, w, h, 4, C.blue, C.blueD, 2.6, 2.5) + `<path d="${rrect(ix, iy, iw, ih, 2.5)}" fill="${glass}" stroke="${C.plum}" stroke-width="1.8"/>` + inner(ix, iy, iw, ih);
  };
  const plug = (x, y, deg) => rot(line([[x - 2, y + 6], [x - 2, y + 10]], C.plum, 1.8) + line([[x + 2, y + 6], [x + 2, y + 10]], C.plum, 1.8) +
    shape(`M${x - 4.5} ${y}H${x + 4.5}V${y + 7}H${x - 4.5}Z`, C.chrome, null, { sw: 2 }), deg, x, y);
  const ant = (d, tx, ty, col) => strokeD(d, C.plum, 3.4) + dot(tx, ty, 4.6, col, 2.2);
  const bolt = (d) => limb(d, C.gold, 5.4);
  // hand (hx, hy) grips the bottom of the remote
  const remote = (hx, hy, deg) => rot(shape(rrect(hx - 6.5, hy - 40, 13, 40, 3), C.chrome, null, { sw: 2.6 }) + dot(hx, hy - 32, 2.6, C.coral, 1.4) + dot(hx, hy - 24, 2.2, C.teal, 1.2) +
    dot(hx, hy - 17, 2.2, C.gold, 1.2) + line([[hx - 3.5, hy - 11], [hx + 3.5, hy - 11]], C.plum, 1.6), deg, hx, hy);

  // legs: planted feet sit on y=185, which foodBoss shifts onto the 190 ground line; the limb ends 2 px behind the nub
  const feet = {
    a: [['M80 152Q80 168 70 178', 72, 185, -1], ['M120 152Q130 160 130 171', 132, 178, 1]],
    b: [['M80 152Q74 160 70 171', 72, 178, -1], ['M120 152Q120 168 128 178', 130, 185, 1]],
    tell: [['M80 152Q80 168 66 178', 68, 185, -1], ['M120 152Q120 168 134 178', 136, 185, 1]],
    hurt: [['M80 152Q82 168 76 178', 78, 185, -1], ['M120 152Q132 160 138 172', 140, 179, 1]],
  }[f].map(([d, x, y, dir]) => nub(x, y, dir, limbCol, 1.8) + limb(d, limbCol, 9) + nub(x, y, dir, limbCol, 1.8)).join('');

  const [lx, ly, lrot] = { a: [26, 78, -15], b: [24, 94, -10], tell: [28, 74, -25], hurt: [40, 72, -30] }[f];
  const [rx, ry, rdeg] = { a: [172, 112, 12], b: [176, 100, 8], tell: [162, 96, 30], hurt: [170, 92, 18] }[f];

  let up = '';
  // antennas curled like hair; the tell stiffens them, the hit bends one
  if (tell) up += ant('M90 34Q88 22 74 12', 72, 10, C.coral) + ant('M110 34Q112 22 126 12', 128, 10, C.gold);
  else if (hurt) up += ant('M92 34Q90 16 70 18Q58 20 56 30', 56, 31, C.coral) + ant('M108 34L110 12L128 4L136 18', 137, 20, C.gold);
  else if (walkB) up += ant('M92 34Q92 14 78 11Q66 10 64 22', 64, 22, C.coral) + ant('M108 34Q108 14 122 11Q134 10 136 22', 136, 22, C.gold);
  else up += ant('M92 34Q92 12 76 12Q64 12 64 24', 64, 24, C.coral) + ant('M108 34Q108 12 124 12Q136 12 136 24', 136, 24, C.gold);

  // arms hang behind the chassis so the shoulder roots are hidden
  up += limb(`M58 126Q22 134 ${lx - 4} ${ly + 26}Q${lx - 5} ${ly + 12} ${lx} ${ly + 3}`, limbCol, 9);
  up += limb(tell ? `M142 124Q166 124 ${rx} ${ry + 4}` : `M142 126Q${rx} 134 ${rx} ${ry + 4}`, limbCol, 9);

  // chassis with three small TVs
  up += slab(54, 104, 92, 48, 8, C.plumSoft, C.plum, 4, 3);
  const lGlass = hurt ? C.frost : SCR;
  const lTv = hurt
    ? rot(stv(58, 109, 26, 28, (ix, iy, iw) => `<rect x="${ix}" y="${iy + 6}" width="${iw}" height="4" fill="${C.coral}"/>` +
      line([[ix + 1, iy + 3], [ix + iw - 1, iy + 3]], C.plum, 1.4) + line([[ix + 1, iy + 13], [ix + iw - 1, iy + 13]], C.plum, 1.4) + line([[ix + 1, iy + 17], [ix + iw - 5, iy + 17]], C.plum, 1.4), lGlass), -10, 71, 123)
    : stv(60, 112, 26, 28, noise(tell ? 3 : walkB ? 11 : 7, tell ? [C.coral, C.gold] : [C.teal, C.coral, C.gold, C.sky, C.lavL, C.white]));
  const eqHs = { a: [8, 13, 7, 15], b: [13, 7, 15, 9], tell: [16, 15, 16, 15], hurt: [4, 6, 3, 5] }[f];
  const mTv = stv(87, 112, 26, 28, (ix, iy, iw, ih) => bars(ix + 1.5, iy + ih - 1.5, iw - 3, eqHs));
  const rTv = stv(114, 112, 26, 28, (ix, iy, iw) => {
    if (hurt) {
      return line([[ix + 3, iy + 3.5], [ix + 7.5, iy + 8]], C.white, 1.8) + line([[ix + 7.5, iy + 3.5], [ix + 3, iy + 8]], C.white, 1.8) +
        line([[ix + iw - 7.5, iy + 3.5], [ix + iw - 3, iy + 8]], C.white, 1.8) + line([[ix + iw - 3, iy + 3.5], [ix + iw - 7.5, iy + 8]], C.white, 1.8) +
        line([[ix + 4, iy + 15], [ix + 7.5, iy + 12.5], [ix + 11, iy + 15], [ix + 14.5, iy + 12.5]], C.white, 1.6);
    }
    if (tell) {
      return line([[ix + 2.5, iy + 3], [ix + 8, iy + 6.5]], C.coral, 2) + line([[ix + iw - 2.5, iy + 3], [ix + iw - 8, iy + 6.5]], C.coral, 2) +
        dot(ix + 5.5, iy + 8, 1.4, C.coral, 0.8) + dot(ix + iw - 5.5, iy + 8, 1.4, C.coral, 0.8) +
        line([[ix + 3.5, iy + 15], [ix + 7, iy + 12], [ix + 10.5, iy + 15], [ix + 14, iy + 12], [ix + iw - 3.5, iy + 15]], C.white, 1.8);
    }
    return dot(ix + 5, iy + 7, 2, C.sky, 1) + dot(ix + iw - 5, iy + 7, 2, C.sky, 1) + line([[ix + 5, iy + 14], [ix + iw - 5, iy + 14]], C.white, 1.8);
  });
  up += lTv + mTv + rTv;

  // cables hang between the legs: [teal end x, coral end x, teal plug tilt, coral plug tilt]
  const [tx, cx, tdeg, cdeg] = { a: [91, 109, 4, -4], b: [95, 113, -4, -8], tell: [85, 115, -14, 14], hurt: [88, 108, 10, 2] }[f];
  up += limb(`M94 154Q${tx - 3} 162 ${tx} 171`, C.teal, 6) + plug(tx, 171, tdeg) + limb(`M106 154Q${cx + 3} 162 ${cx} 171`, C.coral, 6) + plug(cx, 171, cdeg);
  up += slab(50, 148, 100, 10, 5, C.lav, C.lavD, 3, 2.5);

  // head: the big TV
  up += slab(50, 32, 100, 76, 12, C.blue, C.blueD, 4, 4);
  const scrPath = rrect(58, 40, 84, 60, 7);
  let h = `<path d="${scrPath}" fill="${tell ? RED : SCR}" stroke="${C.plum}" stroke-width="2.6" stroke-linejoin="round"/>` + flat('M64 45H81L64 65Z', C.white, 'fill-opacity=".12"');
  if (hurt) {
    h += line([[79, 47], [95, 57], [79, 67]], C.cream, 4.2) + line([[121, 47], [105, 57], [121, 67]], C.cream, 4.2);
    // glitch band tearing across the glass
    h += clipTo(scrPath, `<rect x="58" y="69" width="50" height="3.4" fill="${C.sky}"/><rect x="100" y="69" width="42" height="3.4" fill="${C.coral}"/>` +
      `<rect x="66" y="73.5" width="34" height="2" fill="${C.cream}" fill-opacity=".85"/><rect x="108" y="73.5" width="22" height="2" fill="${C.teal}"/>`);
    const ow = 'M90 81Q94 77 100 80Q106 77 110 81Q116 87 110 92Q100 98 90 92Q84 87 90 81Z';
    h += shape(ow, RED, null, { sw: 2.4, stroke: C.cream }) + shape('M92 91Q100 98 108 91Q100 94 92 91Z', C.coral, null, { sw: 1.6 });
  } else if (tell) {
    const eyeCol = '#FF8A78';
    h += ovalEye(87, 57, 10, 14, 4, 3, { sclera: eyeCol, lid: 0.34, tilt: 15, lc: RED }) + ovalEye(113, 57, 10, 14, -4, 3, { sclera: eyeCol, lid: 0.34, tilt: -15, lc: RED });
    h += strokeD('M72 45L98 54', C.cream, 3.4) + strokeD('M128 45L102 54', C.cream, 3.4);
    const mo = 'M85 79Q100 75 115 79Q117 96 100 96Q83 96 85 79Z';
    h += `<path d="${mo}" fill="${SCR}"/>` + clipTo(mo, [0, 1, 2, 3].map((i) => `<rect x="${86 + i * 7.4}" y="74" width="7.4" height="8" fill="${C.white}" stroke="${C.plum}" stroke-width="1.2"/>`).join('') + ell(100, 98, 11, 6, C.coral, null, { sw: 1.8 })) +
      `<path d="${mo}" fill="none" stroke="${C.plum}" stroke-width="2.2" stroke-linejoin="round"/>`;
  } else {
    h += ovalEye(87, 57, 10, 14, 4.5, 1) + ovalEye(113, 57, 10, 14, 4.5, 1);
    // small mouth with a coral lower lip
    h += shape('M88 83Q100 79 112 83Q110 93 100 93Q90 93 88 83Z', RED, null, { sw: 1.8 });
    h += shape('M89 90Q100 102 111 90Q100 95 89 90Z', C.coral, null, { sw: 1.8 }) + strokeD('M91 83.5Q100 81 109 83.5', C.coralL, 1.8);
  }
  up += h;

  // headband with coral ear cups; the hit knocks it askew
  let hb = limb('M47 74Q45 28 100 28Q155 28 153 74', C.teal, 8);
  hb += ell(47, 74, 8.5, 15, C.coral, null, { sw: 3 }) + flat('M43 66Q43 60 47 59Q44 64 44 68Z', C.coralL);
  hb += ell(153, 74, 8.5, 15, C.coral, null, { sw: 3 }) + flat('M149 66Q149 60 153 59Q150 64 150 68Z', C.coralL);
  up += hurt ? `<g transform="translate(-4 -2)">${rot(hb, -18, 100, 60)}</g>` : hb;

  // hands, the remote and its signal
  up += mitt(lx, ly, 11, lrot, limbCol) + remote(rx, ry, rdeg) + mitt(rx, ry, 11, 15, limbCol);
  const tipX = rx + 40 * Math.sin(rdeg * Math.PI / 180), tipY = ry - 40 * Math.cos(rdeg * Math.PI / 180);
  if (!tell && !hurt) up += limb(`M${n(tipX - 6)} ${n(tipY - 9)}Q${n(tipX)} ${n(tipY - 16)} ${n(tipX + 6)} ${n(tipY - 9)}`, C.gold, 5.4) + limb(`M${n(tipX - 11)} ${n(tipY - 15)}Q${n(tipX)} ${n(tipY - 26)} ${n(tipX + 11)} ${n(tipY - 15)}`, C.gold, 5.4);

  if (walkB) up = `<g transform="translate(0 -2)">${up}</g>`;
  if (hurt) up = rot(up, -8, 100, 156);

  let fx = '';
  if (tell) {
    fx += bolt('M64 12L56 8L59 16L49 14') + bolt('M136 12L144 8L141 16L151 14');
    fx += bolt(`M${n(tipX + 1)} ${n(tipY - 7)}L${n(tipX + 7)} ${n(tipY - 14)}L${n(tipX + 2)} ${n(tipY - 17)}L${n(tipX + 8)} ${n(tipY - 26)}`);
    fx += spark(24, 46, 10, C.gold) + spark(84, 182, 5, C.gold) + spark(116, 182, 5, C.gold);
  }
  if (hurt) {
    fx += bolt('M52 112L46 118L51 121L44 128');
    fx += sweat(28, 36, 1.6) + sweat(20, 54, 1.3) + sweat(178, 30, 1.5);
    fx += shape(star(168, 14, 8, 3, 4), C.gold, null, { sw: 1.6 });
  }
  return foodBoss('boss_electronics', f, `${feet}${up}${fx}`);
}
add('boss_electronics_a', () => bossElectronics('a'));
add('boss_electronics_b', () => bossElectronics('b'));
add('boss_electronics_tell', () => bossElectronics('tell'));
add('boss_electronics_hurt', () => bossElectronics('hurt'));

// Self-Checkout Kiosk (checkout): slim teal kiosk with tall close-set eyes, one hand up "please wait", the other holding a scanner gun (food-limbed).
function bossCheckout(f) {
  const tell = f === 'tell', hurt = f === 'hurt', walkB = f === 'b';
  const T = C.teal, TD = C.tealD, scr = tell ? MGR_TELL : C.plum;
  const keys = (x, y) => Array.from({ length: 6 }, (_, i) => `<rect x="${x + (i % 3) * 10}" y="${y + Math.floor(i / 3) * 10}" width="7" height="7" rx="1.5" fill="${[C.coral, C.gold, C.mint, C.white, C.greenL, C.coralL][i]}" stroke="${C.plum}" stroke-width="1.5"/>`).join('');
  const receipt = (x, y, w, h, deg = 0) => {
    const k = Math.max(2, Math.round(w / 5));
    let d = `M${x} ${y}H${x + w}V${y + h - 4}`, t = '';
    for (let i = 0; i < k; i++) d += `L${n(x + w - (w * (i + 0.5)) / k)} ${y + h}L${n(x + w - (w * (i + 1)) / k)} ${y + h - 4}`;
    for (let yy = y + 7, j = 0; yy < y + h - 8; yy += 6, j++) t += `M${x + 3} ${yy}H${x + w - 3 - (j % 3) * 3}`;
    return rot(shape(d + 'Z', C.cream, null, { sw: 2.4 }) + (t ? strokeD(t, C.creamD, 1.6) : ''), deg, x + w / 2, y);
  };
  const shelf = (x1, y1, x2, y2, ins) => {
    const d = `M${x1 + ins} ${y1}L${x2 - ins} ${y1}L${x2} ${y2}L${x1} ${y2}Z`;
    let st = '';
    for (let x = x1 - 6; x < x2 + 6; x += 11) st += `M${x + 7} ${y1}L${x} ${y2}`;
    return flat(d, C.chrome) + clipTo(d, strokeD(st, C.chromeD, 3.2) + flat(`M${x1} ${y2 - 4}H${x2}V${y2}H${x1}Z`, C.chromeD) + flat(`M${x1} ${y1}H${x2}V${y1 + 3}H${x1}Z`, C.chromeL)) + shape(d, 'none', null, { sw: 3 });
  };
  const badge = (x, y, deg) => `<g transform="translate(${x} ${y}) rotate(${deg} 15 10)">` + shape(rrect(0, 0, 30, 21, 3), C.cream, null, { sw: 2.2 }) +
    flat(rrect(1, 1, 28, 6, 2), C.coral) + dot(9, 13, 3.6, C.mint, 1.6) + flat('M4 20Q9 14 14 20Z', C.mint, `stroke="${C.plum}" stroke-width="1.4"`) +
    strokeD('M18 11H26M18 16H24', C.plum, 1.6) + shape(rrect(10, -3, 10, 5, 1.5), C.chromeD, null, { sw: 1.6 }) + `</g>`;
  // scanner gun in its own coordinates (nose to +x, grip hand at (-2 15)), placed so the hand lands on (hx, hy)
  const gun = (hx, hy, deg, beam, held = true) => {
    let g = '';
    if (beam === 'tell') g += flat('M25 -17L46 -33L46 6L25 -9Z', C.coralL, 'opacity=".9"') + flat('M25 -15.5L46 -23L46 -4L25 -11Z', C.cream) + rays([[30, -13, 45, -13], [30, -15, 44, -26], [30, -11, 44, 0]], C.coral, 1.8);
    else if (beam) g += flat('M25 -16L38 -22L38 -5L25 -11Z', C.coralL, 'opacity=".9"') + rays([[27, -13.5, 37, -13.5]], C.coral, 1.6);
    g += shape('M4 -3L11 -3L10 4Q9 6.5 7 5Z', C.chromeD, null, { sw: 1.8 });
    g += shape('M5 -4L-9 -4L-12 24Q-12 28 -8 28L-1 28Q3 28 3 24Z', C.plumSoft, null, { sw: 2.4 }) + strokeD('M-8 9H-1M-9 14H-2M-10 19H-3', C.lavD, 1.5);
    g += shape('M-16 -26H12L26 -20V-7L12 -2H-16Q-20 -2 -20 -6V-22Q-20 -26 -16 -26Z', C.coral, C.coralD, { sw: 2.6, dx: 3, dy: 3 });
    g += shape(rrect(-16, -22, 17, 11, 1.5), C.cream, null, { sw: 1.4 }) + strokeD('M-13.5 -19.5V-13.5M-9.5 -19.5V-13.5M-6.5 -19.5V-13.5M-3 -19.5V-13.5', C.plum, 1.1) + strokeD('M-11.5 -19.5V-13.5M-1 -19.5V-13.5', C.plum, 2);
    g += shape('M11 -23L24 -18V-9L11 -4Z', MGR_SCREEN, null, { sw: 2 }) + flat('M13.5 -19.5L22 -16.2V-10.4L13.5 -7Z', tell ? '#FFC0A8' : '#FF4A3D');
    if (held) g += mitt(-2, 15, 9.5, 0, T);
    return `<g transform="translate(${hx} ${hy}) rotate(${deg}) translate(2 -15)">${g}</g>`;
  };

  // feet: planted ones sit on y=185, which foodBoss's +5 shift puts on the 190 ground line
  const feet = {
    a: [['M83 150Q80 167 76 180', 76, 185, -1], ['M117 150Q129 160 130 172', 132, 178, 1]],
    b: [['M83 150Q71 160 70 172', 68, 178, -1], ['M117 150Q120 167 124 180', 124, 185, 1]],
    tell: [['M83 150Q78 167 72 180', 72, 185, -1], ['M117 150Q122 167 128 180', 128, 185, 1]],
    hurt: [['M83 150Q76 166 70 180', 70, 185, -1], ['M117 150Q130 160 134 171', 134, 178, 1]],
  }[f].map(([d, x, y, dir]) => nub(x, y, dir, T, 1.8) + limb(d, T, 8.5) + nub(x, y, dir, T, 1.8)).join('');

  const [ra, rhx, rhy, rdeg, rrad] = { a: ['M63 104Q42 108 38 84', 38, 76, 10, 11], b: ['M63 104Q38 100 35 68', 35, 60, -10, 11],
    tell: ['M63 104Q34 100 30 68', 30, 60, -12, 12.5], hurt: ['M63 104Q40 108 34 84', 34, 76, -20, 11] }[f];
  const [ga, ghx, ghy, gdeg] = { a: ['M137 104Q148 104 150 120', 150, 126, -6], b: ['M137 104Q146 112 148 130', 148, 136, 6],
    tell: ['M137 106Q144 106 146 114', 146, 120, -4], hurt: ['M137 104Q158 100 164 118', 166, 124, 0] }[f];

  let up = limb(ra, T, 8.5) + limb(ga, T, 8.5);
  up += shape('M64 42L136 42L141 146L59 146Z', T, TD, { sw: 4, dx: 5, dy: 5 }) + flat('M67 52L70 52L72 98L69 98Z', C.mintL, 'opacity=".5"');
  up += shape(rrect(61, 15, 78, 28, 12), T, TD, { sw: 3.5, dx: 5, dy: 5 });
  if (tell) up += `<rect x="69" y="19" width="62" height="17" rx="8.5" fill="${C.coralL}" opacity=".7"/>`;
  up += `<rect x="73" y="23" width="54" height="9" rx="4.5" fill="${tell ? '#FF8A70' : C.coral}" stroke="${C.plum}" stroke-width="2.4"/>` +
    strokeD('M77 26H98', tell ? C.cream : C.coralL, tell ? 2.6 : 1.8) + strokeD('M104 30H122', C.coralD, 1.6);
  up += shape(rrect(66, 46, 68, 60, 9), C.mint, null, { sw: 3 }) + flat(rrect(71, 51, 58, 50, 5), scr);
  if (hurt) {
    up += strokeD('M82 58L97 68L82 78', C.cream, 4.2) + strokeD('M118 58L103 68L118 78', C.cream, 4.2);
    const ow = 'M89 85Q88 79 94 79Q97 76 100 79Q103 76 106 79Q112 79 111 85Q114 91 108 93Q104 96 100 93Q96 96 92 93Q86 91 89 85Z';
    up += `<path d="${ow}" fill="${MGR_SCREEN}"/>` + clipTo(ow, ell(100, 94, 6, 4, C.coralL, null, { sw: 1.6 })) + shape(ow, 'none', null, { sw: 2.4, stroke: C.cream });
  } else if (tell) {
    const eyeCol = '#FF9A82';
    up += ovalEye(90, 69, 9.5, 13, 4, 2, { sclera: eyeCol, lid: 0.36, tilt: 15, lc: scr }) + ovalEye(110, 69, 9.5, 13, -4, 2, { sclera: eyeCol, lid: 0.36, tilt: -15, lc: scr });
    up += strokeD('M77 55Q89 57 100 65', C.cream, 3.8) + strokeD('M123 55Q111 57 100 65', C.cream, 3.8);
    const mo = 'M82 85Q100 99 118 85Q114 99 100 99Q86 99 82 85Z';
    up += `<path d="${mo}" fill="${MGR_SCREEN}"/>` + clipTo(mo, flat(rect(80, 84, 40, 7), C.cream) + strokeD('M88 84V91M94 84V91M100 84V91M106 84V91M112 84V91', C.plum, 1.3) + flat(rect(80, 90.5, 40, 1.6), C.plum)) + shape(mo, 'none', null, { sw: 2.2, stroke: C.cream });
  } else {
    up += ovalEye(90, 69, 9.5, 13, 4.6, 2, { lid: 0.3, lc: T }) + ovalEye(110, 69, 9.5, 13, 4.6, 2, { lid: 0.2, lc: T });
    up += strokeD('M80 55Q90 54 99 57', C.cream, 3.8) + strokeD('M102 56Q112 50 121 53', C.cream, 3.8);
    up += flat('M91 88Q100 85 110 86Q112 94 101 95.5Q92 94 91 88Z', C.coralL) + flat('M93 93Q101 97 109 92Q106 96 101 95.5Q96 95.5 93 93Z', C.coral) +
      strokeD('M91.5 88.4Q101 91.6 111 86', MGR_SCREEN, 1.8) + strokeD('M111 86Q113 86 113.4 88.4', C.coral, 1.5);
  }
  up += shape(rrect(86, 109, 28, 6, 3), MGR_SCREEN, null, { sw: 2 }) + dot(121, 112, 2.6, tell ? C.coral : C.green, 1.5);
  if (!hurt) up += badge(65, 120, 0);
  up += keys(108, 121);
  up += shelf(52, 142, 148, 154, 8);
  if (tell) up += receipt(94, 113, 14, 50, -6);
  else if (hurt) up += shape('M93 114L109 114L112 120L108 126L113 133L106 139L99 135L94 140L92 131L96 125L91 119Z', C.cream, null, { sw: 2.2 }) + strokeD('M96 122L104 125M99 130L108 132M97 119L100 126', C.creamD, 1.5);
  else up += receipt(97, 113, 9, 12, 0);
  if (!hurt) up += gun(ghx, ghy, gdeg, tell ? 'tell' : 'idle');
  up += `<g transform="translate(${2 * rhx} 0) scale(-1 1)">${mitt(rhx, rhy, rrad, rdeg, T)}</g>`;
  if (hurt) up += mitt(ghx, ghy, 10, -20, T);
  if (!tell && !hurt) up += rays([[rhx - 15, rhy - 5, rhx - 22, rhy - 9], [rhx - 16, rhy + 5, rhx - 23, rhy + 6], [rhx - 8, rhy - 15, rhx - 12, rhy - 21]], C.lav);

  up = `<g transform="translate(0 ${walkB ? -2 : 0})">${up}</g>`;
  if (tell) up = rot(up, 4, 100, 150);
  if (hurt) up = rot(up, -8, 100, 156);

  let fx = '';
  if (tell) {
    fx += spark(26, 26, 11) + spark(176, 34, 11);
    fx += rays([[84, 11, 80, 3], [100, 10, 100, 1], [116, 11, 120, 3]], C.coral, 3) + rays([[22, 50, 15, 45], [21, 64, 14, 67]], C.coral, 3);
    fx += receipt(118, 148, 8, 14, 24) + receipt(70, 156, 7, 12, -30);
  }
  if (hurt) {
    fx += badge(20, 116, -30);
    fx += gun(144, 48, 35, false, false) + rays([[116, 34, 124, 38], [114, 48, 123, 50]], C.lav);
    fx += sweat(48, 26, 1.6) + sweat(38, 42, 1.3) + sweat(150, 72, 1.3);
    fx += shape(star(160, 108, 7, 2.6, 4), C.gold, null, { sw: 1.6 });
  }
  return foodBoss('boss_checkout', f, `<g transform="translate(${tell ? -7 : hurt ? -2 : -4} 0)">${feet}${up}${fx}</g>`);
}
add('boss_checkout_a', () => bossCheckout('a'));
add('boss_checkout_b', () => bossCheckout('b'));
add('boss_checkout_tell', () => bossCheckout('tell'));
add('boss_checkout_hurt', () => bossCheckout('hurt'));

// =====================================================================================
// ITEM ICONS (192x192, outline 5)
// =====================================================================================
const S5 = (g, f, sh, o = {}) => shape(g, f, sh, { sw: SWi, ...o });
const icon = (inner, sy = 168) => shadowE(96, sy, 64, 11, 0.24) + inner;
const scalePts = (pts, k, cx, cy) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
const curve = (d, w, fill, ol = SWi) =>
  `<path d="${d}" fill="none" stroke="${C.plum}" stroke-width="${w + ol * 2}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;

add('icon_toaster', () => {
  const x = 26, y = 86, w = 106, h = 58, dx = 30, dy = 22, tp = (u, v) => [x + w * u + dx * v, y - dy * v];
  let s = prism(x, y, w, h, dx, dy, [C.chrome, C.chromeD], [C.chromeL, C.chrome], [C.chromeD, C.lavD], { sw: SWi, sdx: 7, sdy: 5 });
  s += shape(rect(x + 3, y + 34, w - 6, h - 37), C.cream, C.creamD, { dx: 4, dy: 3 });
  s += flat([[x + 8, y + 8], [x + 46, y + 8], [x + 36, y + 15], [x + 8, y + 15]], C.white, 'opacity=".7"');
  s += shape([tp(0.12, 0.34), tp(0.88, 0.34), tp(0.88, 0.68), tp(0.12, 0.68)], '#1E1028', null, { sw: SW });
  const toast = [[72, 74], [70, 58], [65, 48], [66, 36], [76, 28], [96, 25], [116, 28], [126, 36], [127, 48], [122, 58], [120, 74]];
  s += S5(toast, C.bread, C.breadD, { dx: 4, dy: 3 });
  s += shape(scalePts(toast, 0.78, 96, 52), '#F7D690', '#EDB870', { sw: 2.5, stroke: C.breadD, dx: 3, dy: 2 });
  s += line([[x + w - 14, y + 8], [x + w - 14, y + 28]], C.plum, 5) + shape(rect(x + w - 22, y + 14, 15, 8), C.coral, C.coralD, { dx: 0, dy: 2.5 });
  s += `<circle cx="${x + 22}" cy="${y + 47}" r="6.5" fill="${C.plumSoft}" stroke="${C.plum}" stroke-width="3"/><circle cx="${x + w - 24}" cy="${y + 47}" r="4.2" fill="${C.gold}" stroke="${C.plum}" stroke-width="2.5"/>`;
  s += shape(rect(x + 6, y + h, 16, 7), C.plum, null, { sw: 3 }) + shape(rect(x + w - 22, y + h, 16, 7), C.plum, null, { sw: 3 });
  return icon(s, 160);
});

add('icon_pan', () => {
  let s = shape([[144, 92], [150, 80], [182, 56], [188, 68], [158, 100]], C.breadD, '#8A4F20', { dx: 3, dy: 3, sw: SWi - 1 });
  s += flat([[154, 80], [180, 60], [182, 64], [156, 84]], C.breadL, 'opacity=".8"');
  s += `<circle cx="156" cy="92" r="3" fill="${C.plum}"/><circle cx="164" cy="84" r="3" fill="${C.plum}"/>`;
  s += ell(92, 116, 66, 42, '#3A2F4D', '#251A33', { sw: SWi, dx: 3, dy: 3 });
  s += ell(92, 102, 66, 42, '#5B4F76', '#3F3358', { sw: SWi, dx: 4, dy: 4 });
  s += ell(92, 104, 52, 31, '#2A1E38', '#1B1127', { sw: 3, dx: -3, dy: -3 });
  s += `<path d="M44 90 A52 34 0 0 1 90 66" fill="none" stroke="${C.lavL}" stroke-width="4" stroke-linecap="round" opacity=".8"/>`;
  s += flat([[60, 108], [84, 100], [82, 106], [64, 112]], '#6B5F86', 'opacity=".9"') + flat([[104, 112], [124, 106], [122, 111]], '#6B5F86');
  s += `<ellipse cx="146" cy="95" rx="6" ry="3" fill="${C.plum}" transform="rotate(-24 146 95)"/>`;
  return icon(s, 164);
});

add('icon_nailgun', () => {
  let s = S5([[34, 52], [118, 46], [130, 76], [36, 86]], C.coral, C.coralD, { dx: 6, dy: 5 });
  s += S5([[116, 56], [168, 60], [170, 84], [124, 80]], C.chrome, C.chromeD, { dx: 4, dy: 5 });
  s += flat([[128, 60], [166, 63], [166, 66], [128, 64]], C.white, 'opacity=".8"');
  s += shape([[168, 66], [180, 70], [180, 76], [168, 78]], C.plumSoft, null, { sw: 3 });
  s += S5([[92, 94], [150, 98], [148, 118], [88, 112]], C.chromeD, C.lavD, { dx: 3, dy: 3 }); // magazine
  for (let i = 0; i < 5; i++) s += line([[100 + i * 10, 98 + i * 0.9], [100 + i * 10, 112 + i * 0.9]], C.chromeL, 2.5);
  s += S5([[56, 84], [92, 82], [86, 148], [52, 150]], C.gold, C.goldD, { dx: 5, dy: 3 });
  for (let i = 0; i < 3; i++) s += line([[60 - i * 0.5, 104 + i * 10], [84 - i, 102 + i * 10]], C.goldD, 3);
  s += shape([[92, 88], [102, 88], [98, 106], [92, 104]], C.plum, null, { sw: 3 });
  s += S5([[40, 146], [100, 146], [100, 168], [42, 168]], C.plumSoft, C.plum, { dx: 3, dy: 3 });
  s += flat(rect(46, 152, 20, 6), C.gold) + flat([[38, 58], [90, 54], [90, 60], [40, 64]], C.coralL, 'opacity=".7"');
  s += shape(rect(34, 70, 22, 10), C.gold, C.goldD, { dx: 0, dy: 3, sw: 3 });
  return icon(s, 172);
});

add('icon_vacuum', () => {
  let s = curve('M124 108 C158 110 170 62 150 36', 11, C.teal) + `<path d="M124 108 C158 110 170 62 150 36" fill="none" stroke="${C.tealD}" stroke-width="11" stroke-dasharray="3 6" opacity=".7"/>`;
  s += tube([[150, 36], [162, 76], [164, 124]], 6, C.chrome, 4);
  s += S5([[142, 24], [160, 22], [158, 44], [144, 44]], C.coral, C.coralD, { dx: 3, dy: 3 });
  s += S5([[140, 122], [180, 118], [182, 144], [144, 150]], C.teal, C.tealD, { dx: 4, dy: 4 });
  s += ell(46, 150, 13, 13, C.plumSoft, C.plum, { sw: 4, dx: 2, dy: 2 }) + ell(108, 150, 13, 13, C.plumSoft, C.plum, { sw: 4, dx: 2, dy: 2 });
  s += S5([[26, 92], [96, 80], [124, 94], [128, 126], [108, 142], [34, 146], [22, 120]], C.lav, C.lavD, { dx: 7, dy: 6 });
  s += shape([[28, 104], [100, 90], [124, 100], [125, 112], [27, 124]], C.teal, C.tealD, { dx: 5, dy: 4, sw: SW });
  s += flat([[34, 94], [80, 86], [84, 90], [38, 99]], C.lavL, 'opacity=".9"');
  s += `<circle cx="104" cy="124" r="6" fill="${C.cream}" stroke="${C.plum}" stroke-width="3"/><circle cx="46" cy="150" r="4" fill="${C.lavL}"/><circle cx="108" cy="150" r="4" fill="${C.lavL}"/>`;
  s += shape([[56, 76], [84, 72], [86, 82], [58, 86]], C.plumSoft, null, { sw: 3.5 });
  return icon(s, 172);
});

add('icon_fan', () => {
  const cx = 92, cy = 80;
  let s = S5([[84, 128], [102, 128], [104, 152], [82, 152]], C.coral, C.coralD, { dx: 4, dy: 0 });
  s += S5([[52, 150], [134, 150], [146, 166], [40, 166]], C.soda, C.sodaD, { dx: 3, dy: 4 });
  s += flat([[56, 154], [110, 154], [104, 158], [52, 158]], C.coralL, 'opacity=".7"');
  let c = ell(cx, cy, 58, 56, '#FFE7E0', '#F6C9BF', { sw: SWi, dx: 5, dy: 5 });
  for (let i = 0; i < 4; i++) {
    const t = (i * 90 + 25) * Math.PI / 180, p = (r, a) => [cx + Math.cos(t + a) * r, cy + Math.sin(t + a) * r];
    c += shape([p(10, -0.25), p(46, -0.55), p(50, 0.25), p(10, 0.45)], C.soda, C.sodaD, { sw: 3.5, dx: 2, dy: 2 });
  }
  for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; c += line([[cx + Math.cos(t) * 12, cy + Math.sin(t) * 12], [cx + Math.cos(t) * 54, cy + Math.sin(t) * 52]], C.plum, 2); }
  c += `<ellipse cx="${cx}" cy="${cy}" rx="38" ry="36" fill="none" stroke="${C.plum}" stroke-width="2.2"/><ellipse cx="${cx}" cy="${cy}" rx="22" ry="21" fill="none" stroke="${C.plum}" stroke-width="2.2"/>`;
  c += `<ellipse cx="${cx}" cy="${cy}" rx="56" ry="54" fill="none" stroke="${C.plum}" stroke-width="14"/><ellipse cx="${cx}" cy="${cy}" rx="56" ry="54" fill="none" stroke="${C.soda}" stroke-width="7"/>`;
  c += `<path d="M44 58 A56 54 0 0 1 84 28" fill="none" stroke="${C.coralL}" stroke-width="3.5" stroke-linecap="round"/>`;
  c += `<circle cx="${cx}" cy="${cy}" r="11" fill="${C.gold}" stroke="${C.plum}" stroke-width="4"/><circle cx="${cx + 1}" cy="${cy + 1}" r="4" fill="${C.coral}"/>`;
  return icon(s + rot(c, -6, cx, cy), 168);
});

add('icon_fuel', () => {
  const x = 42, y = 56, w = 86, h = 98, dx = 22, dy = 14;
  let s = tube([[x + 34, y - 2], [x + 36, y - 26], [x + 68, y - 28], [x + 68, y - 2]], 7, C.soda, 4);
  s += prism(x, y, w, h, dx, dy, [C.soda, C.sodaD], ['#F0625A', C.soda], [C.sodaD, '#7D1F27'], { sw: SWi, sdx: 7, sdy: 5 });
  s += S5(rect(x + 6, y - 34, 22, 26), C.gold, C.goldD, { dx: 4, dy: 0, sw: 4 });
  s += flat(rect(x + 8, y - 32, 6, 20), C.cream, 'opacity=".7"');
  s += shape(rect(x + 12, y + 14, w - 24, h - 28), C.soda, C.sodaD, { stroke: C.sodaD, sw: 3, dx: -3, dy: -3 });
  s += line([[x + 26, y + 30], [x + w - 26, y + h - 30]], C.plum, 16) + line([[x + w - 26, y + 30], [x + 26, y + h - 30]], C.plum, 16);
  s += line([[x + 26, y + 30], [x + w - 26, y + h - 30]], C.cream, 9) + line([[x + w - 26, y + 30], [x + 26, y + h - 30]], C.cream, 9);
  s += flat([[x + 6, y + 5], [x + 50, y + 5], [x + 44, y + 11], [x + 6, y + 11]], C.coralL, 'opacity=".7"');
  return icon(s, 170);
});

add('icon_battery', () => {
  const x = 46, y = 58, w = 84, h = 90, dx = 26, dy = 16;
  let s = prism(x + 12, y - 4, 20, 14, 7, 5, [C.chromeD, C.lavD], [C.chrome, C.chromeD], [C.lavD, C.plum], { sw: SW + 0.5 });
  s += prism(x + w - 34, y - 4, 20, 14, 7, 5, [C.chromeD, C.lavD], [C.chrome, C.chromeD], [C.lavD, C.plum], { sw: SW + 0.5 });
  s += prism(x, y, w, h, dx, dy, [C.banana, C.bananaD], ['#FFE57A', C.banana], [C.bananaD, '#A97B16'], { sw: SWi, sdx: 7, sdy: 5 });
  s += shape(rect(x + 2.5, y + 2.5, w - 5, 16), C.plumSoft, C.plum, { sw: 2, dx: 0, dy: 3 });
  s += flat(rect(x + 8, y + 7, 18, 4), C.lav) + flat(rect(x + 30, y + 7, 8, 4), C.coral);
  const bolt = [[0, -32], [-20, 6], [-4, 6], [-12, 34], [20, -10], [4, -10], [14, -32]].map(([a, b]) => [x + w / 2 + a, y + 52 + b]);
  s += shape(bolt, C.plum, null, { sw: 4 }) + flat([bolt[0], bolt[1], [bolt[1][0] + 7, bolt[1][1] - 1]], C.lav, 'opacity=".6"');
  s += flat([[x + 6, y + 24], [x + 12, y + 24], [x + 10, y + 76], [x + 6, y + 80]], '#FFF0A0', 'opacity=".8"');
  return icon(s, 164);
});

add('icon_magnet', () => {
  const arch = 'M50 148 L50 98 A46 46 0 0 1 142 98 L142 148';
  const tr = (d, dx, dy) => `<g transform="translate(${dx} ${dy})">${d}</g>`;
  const U = (col, ol) => `<path d="${arch}" fill="none" stroke="${C.plum}" stroke-width="44"/><path d="${arch}" fill="none" stroke="${col}" stroke-width="34"/>`;
  let s = tr(U(C.coralD), 7, 8) + U(C.soda);
  s += `<path d="M38 132 L38 98 A58 58 0 0 1 90 38" fill="none" stroke="${C.coralL}" stroke-width="5" stroke-linecap="round" opacity=".95"/>`;
  s += line([[67, 100], [67, 120]], C.sodaD, 4) + line([[125, 100], [125, 120]], C.sodaD, 4);
  for (const xx of [33, 125]) {
    s += shape(rect(xx, 122, 34, 32), C.chrome, C.chromeD, { sw: SWi, dx: 5, dy: 0 }) + flat(rect(xx + 4, 126, 6, 22), C.white, 'opacity=".8"') + line([[xx, 130], [xx + 34, 130]], C.plum, 3);
  }
  return icon(s, 170);
});

add('icon_ice', () => {
  const x0 = 36, y0 = 46, x1 = 156, y1 = 138;
  const zig = (a, b, k, amp) => { const out = []; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L; for (let i = 0; i < k; i++) { const t0 = i / k, t1 = (i + 0.5) / k; out.push([a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1 + nx * amp, a[1] + dy * t1 + ny * amp]); } return out; };
  const outline = [...zig([x0, y0], [x1, y0], 14, -4), ...zig([x1, y0], [x1, y1], 11, -4), ...zig([x1, y1], [x0, y1], 14, -4), ...zig([x0, y1], [x0, y0], 11, -4)];
  const under = outline.map(([x, y]) => [x, y + 11]);
  let s = S5(under, C.frostD, null, { sw: SWi });
  s += S5(outline, C.frost, '#A9DDF0', { dx: 5, dy: 5 });
  s += shape(rect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24), '#E8F9FF', '#C6EBF8', { sw: 3, stroke: C.frostD, dx: 3, dy: 3 });
  s += snowflake(96, 92, 28, C.plum, 9).replace(/stroke-linecap="round"/g, 'stroke-linecap="round" opacity="0"') +
    snowflake(96, 92, 28, C.sky, 6);
  s += flat([[x0 + 18, y0 + 18], [x0 + 52, y0 + 18], [x0 + 18, y0 + 44]], C.white, 'opacity=".85"');
  return icon(rot(s, -7, 96, 92), 170);
});

add('icon_hotsauce', () => {
  let s = S5([[66, 82], [126, 80], [140, 98], [140, 160], [126, 170], [66, 170], [52, 160], [52, 98]], C.soda, C.sodaD, { dx: 8, dy: 5 });
  s += S5([[82, 44], [112, 44], [114, 82], [80, 82]], C.soda, C.sodaD, { dx: 5, dy: 0 });
  s += S5([[76, 22], [118, 22], [120, 46], [74, 46]], C.green, C.greenD, { dx: 5, dy: 3 });
  for (const xx of [84, 94, 104]) s += line([[xx, 26], [xx, 42]], C.greenD, 3);
  s += shape([[54, 104], [138, 102], [138, 150], [54, 152]], C.cream, C.creamD, { dx: 5, dy: 4, sw: 4 });
  s += `<g transform="translate(88 126) rotate(-12)">` + shape('M-18 -8 Q6 -22 22 -4 Q28 8 20 20 Q16 4 -18 0 Z', C.soda, C.sodaD, { sw: 3.5, dx: 2, dy: 2 }) + shape([[-18, -8], [-26, -16], [-22, -2]], C.green, C.greenD, { sw: 3 }) + `</g>`;
  s += flat([[60, 90], [66, 90], [62, 150]], C.coralL, 'opacity=".7"') + flat([[86, 52], [92, 52], [92, 78], [86, 78]], C.coralL, 'opacity=".6"');
  s += shape('M120 150 Q126 142 130 150 Q130 157 125 157 Q120 157 120 150Z', C.soda, C.sodaD, { sw: 3, dx: 1, dy: 1 }).replace(/<path/, '<path opacity="0"');
  return icon(s, 172);
});

add('icon_lunchbox', () => {
  const x = 30, y = 96, w = 118, h = 54, dx = 26, dy = 18;
  let s = curve('M66 74 C64 46 76 40 98 40 C120 40 128 48 126 66', 7, C.gold, 4);
  s += prism(x, y, w, h, dx, dy, [C.teal, C.tealD], ['#5BD0BE', C.teal], [C.tealD, '#1D6A60'], { sw: SWi, sdx: 7, sdy: 5 });
  s += prism(x - 4, y - 24, w + 8, 26, dx, dy, [C.coral, C.coralD], [C.coralL, C.coral], [C.coralD, '#8F2D2C'], { sw: SWi, sdx: 5, sdy: 4 });
  s += shape(rect(x + w / 2 - 14, y - 10, 28, 24), C.gold, C.goldD, { dx: 4, dy: 3, sw: 4 }) + `<circle cx="${x + w / 2}" cy="${y + 5}" r="3.4" fill="${C.plum}"/>`;
  s += shape(star(x + 26, y + 32, 14, 6, 5), C.cream, C.creamD, { sw: 3, dx: 1.5, dy: 1.5 });
  s += flat([[x + 6, y - 18], [x + 56, y - 18], [x + 50, y - 12], [x + 6, y - 12]], C.coralL, 'opacity=".8"') + flat(rect(x + 6, y + 52, w - 12, 0.1), C.plum);
  return icon(s, 166);
});

add('icon_bell', () => {
  let s = ell(96, 158, 72, 16, C.plumSoft, C.plum, { sw: SWi, dx: 4, dy: 4 });
  s += `<ellipse cx="96" cy="152" rx="52" ry="8" fill="${C.lavD}" opacity=".6"/>`;
  s += S5('M36 142 C36 84 60 50 96 50 C132 50 156 84 156 142 Z', C.gold, C.goldD, { dx: 9, dy: 4 });
  s += S5([[26, 142], [166, 142], [160, 156], [32, 156]], C.gold, C.goldD, { dx: 3, dy: 5 });
  s += flat('M50 126 C46 92 62 66 88 58 C72 76 66 98 70 126 Z', '#FFE08A', 'opacity=".95"');
  s += flat([[44, 146], [90, 146], [86, 151], [46, 151]], '#FFE08A', 'opacity=".8"');
  s += S5(rect(88, 40, 16, 12), C.goldD, null, { sw: 4 }) + `<circle cx="96" cy="36" r="10" fill="${C.gold}" stroke="${C.plum}" stroke-width="5"/><circle cx="92.5" cy="32.5" r="3" fill="#FFE08A"/>`;
  return icon(s, 174);
});

add('icon_boot', () => {
  let s = ell(96, 160, 74, 12, C.plumSoft, C.plum, { sw: SWi, dx: 4, dy: 3 });
  s += S5('M58 32 L110 32 L110 92 C140 98 160 112 160 136 L160 148 L48 148 L58 32 Z', C.coral, C.coralD, { dx: 8, dy: 5 });
  s += S5([[44, 138], [164, 138], [164, 156], [44, 156]], C.cream, C.creamD, { dx: 3, dy: 4 });
  s += S5(rect(54, 32, 60, 14), C.coralL ?? C.coral, null, { sw: 4 });
  const bolt = [[0, -22], [-15, 4], [-3, 4], [-8, 24], [14, -6], [3, -6], [11, -22]].map(([a, b]) => [92 + a, 96 + b]);
  s += shape(bolt, C.gold, C.goldD, { sw: 4 });
  s += flat([[64, 52], [72, 52], [70, 120], [64, 124]], C.coralL ?? C.coral, 'opacity=".7"');
  return icon(s, 172);
});


add('icon_bumper', () => {
  let s = S5(rect(28, 96, 136, 46), C.teal, C.tealD, { dx: 8, dy: 5 });
  for (const x of [48, 84, 120]) s += flat([[x, 98], [x + 16, 98], [x + 6, 140], [x - 10, 140]], C.cream, 'opacity=".55"');
  for (const x of [38, 150]) s += `<circle cx="${x}" cy="119" r="6" fill="${C.chrome}" stroke="${C.plum}" stroke-width="4"/>`;
  s += S5(rect(40, 142, 20, 16), C.chromeD, null, { sw: 4 }) + S5(rect(132, 142, 20, 16), C.chromeD, null, { sw: 4 });
  s += shape(star(96, 52, 30, 14, 8), C.gold, C.goldD, { sw: 4 }) + flat(star(96, 52, 14, 7, 8), C.cream);
  return icon(s, 168);
});

add('icon_sparewheel', () => {
  let s = ell(96, 98, 62, 62, C.plumSoft, C.plum, { sw: SWi, dx: 6, dy: 6 });
  s += ell(96, 98, 44, 44, C.chrome, C.chromeD, { sw: 4, dx: 3, dy: 3 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; s += line([[96, 98], [96 + Math.cos(a) * 42, 98 + Math.sin(a) * 42]], C.chromeD, 5); }
  s += ell(96, 98, 14, 14, C.gold, C.goldD, { sw: 4, dx: 2, dy: 2 });
  s += flat(star(96, 98, 7, 3, 4, -45), C.plum);
  s += curve('M138 52 C158 66 164 86 160 106', 8, C.coral, 4) + flat([[168, 100], [150, 106], [162, 124]], C.coral, `stroke="${C.plum}" stroke-width="4" stroke-linejoin="round"`);
  return icon(s, 166);
});

add('icon_tipjar', () => {
  let s = S5(rect(46, 62, 100, 98), C.frost, C.frostD, { dx: 6, dy: 5 });
  s += S5(rect(40, 44, 112, 22), C.coral, C.coralD, { dx: 4, dy: 3 });
  for (const [x, y] of [[70, 140], [96, 144], [122, 140], [82, 124], [110, 126], [96, 108]]) s += ell(x, y, 15, 7, C.gold, C.goldD, { sw: 3, dx: 1.5, dy: 1.5 });
  s += S5(rect(60, 70, 72, 26), C.cream, C.creamD, { sw: 4 }) + shape(star(96, 83, 10, 4.5, 5), C.coral, null, { sw: 2.5 });
  s += flat([[52, 70], [62, 70], [60, 150], [52, 150]], C.white, 'opacity=".6"');
  return icon(s, 168);
});

add('icon_flag', () => {
  let s = tube([[58, 164], [58, 28]], 8, C.chrome, 4);
  s += ell(58, 24, 10, 10, C.gold, C.goldD, { sw: 4, dx: 2, dy: 2 });
  s += S5([[62, 40], [160, 66], [62, 98]], C.coral, C.coralD, { dx: 6, dy: 5 });
  s += shape(star(100, 68, 14, 6, 5), C.cream, null, { sw: 3 });
  s += flat([[66, 46], [112, 58], [66, 62]], C.coralL, 'opacity=".7"');
  s += S5([[30, 164], [86, 164], [78, 146], [38, 146]], C.chromeD, null, { sw: 4 });
  return icon(s, 170);
});

add('icon_canopener', () => {
  // a tin can with its lid half cut away, and a coral-handled opener clamped to the rim
  let s = can(68, 84, 84, 74, C.chrome, C.chromeD, C.gold, { sw: SWi });
  s += S5([[26, 84], [64, 96], [96, 84], [78, 70], [42, 72]], C.chromeL, C.chromeD, { dx: 0, dy: 3, sw: 4 });
  s += shape([[96, 84], [112, 92], [104, 98], [92, 92]], C.chromeD, '#7C8599', { sw: 3.5, dx: 1.5, dy: 1.5 }); // the curled-back lid edge
  // opener: two crossed levers, a cutting wheel at the rim
  s += rot(S5(rect(104, 26, 20, 92), C.coral, C.coralD, { dx: 5, dy: 3 }), 24, 114, 96);
  s += rot(S5(rect(128, 40, 18, 86), C.coral, C.coralD, { dx: 5, dy: 3 }), -14, 137, 100);
  s += ell(112, 112, 22, 22, C.chrome, C.chromeD, { sw: SWi, dx: 3, dy: 3 });
  s += shape(star(112, 112, 17, 11, 8), C.gold, C.goldD, { sw: 3.5, dx: 2, dy: 2 });
  s += `<circle cx="112" cy="112" r="4.5" fill="${C.plum}"/>`;
  s += flat([[110, 30], [118, 30], [124, 70], [118, 70]], C.coralL, 'opacity=".75"');
  return icon(s, 170);
});

add('icon_decaf', () => {
  // a to-go coffee cup with a plum lid, a bread-brown sleeve carrying a green leaf (decaf), and a lazy curl of steam
  let s = line([[84, 44], [76, 34], [86, 24], [78, 14]], C.lavL, 6) + line([[110, 46], [102, 36], [112, 26]], C.lavL, 5);
  s += S5([[54, 80], [138, 80], [124, 162], [68, 162]], C.cream, C.creamD, { dx: 7, dy: 4 });
  s += S5([[59, 106], [133, 106], [128, 138], [64, 138]], C.bread, C.breadD, { dx: 5, dy: 3, sw: 4 });
  s += shape(star(96, 122, 15, 7, 5, -100), C.green, C.greenD, { sw: 3.5, dx: 2, dy: 2 });
  s += S5([[48, 64], [144, 64], [144, 82], [48, 82]], C.plumSoft, C.plum, { dx: 4, dy: 3, sw: 4 });
  s += S5(ellPath(96, 58, 22, 9), C.plumSoft, C.plum, { dx: 3, dy: 2, sw: 4 });
  s += flat([[64, 90], [72, 90], [78, 158], [72, 158]], C.white, 'opacity=".7"') + flat([[54, 68], [92, 68], [92, 72], [54, 72]], C.lav, 'opacity=".8"');
  return icon(s, 170);
});

// =====================================================================================
// ENVIRONMENT
// =====================================================================================
add('floor_tile', () => {
  let s = `<rect width="128" height="128" fill="${C.mint}"/>` +
    `<rect x="64" y="0" width="64" height="64" fill="${C.mintL}"/><rect x="0" y="64" width="64" height="64" fill="${C.mintL}"/>`;
  s += `<path d="M64 0V128M0 64H128M0 0V128M0 0H128" stroke="${C.mintD}" stroke-width="2" opacity=".55" fill="none"/>`;
  s += `<path d="M64 0V128M0 64H128" stroke="${C.white}" stroke-width="1" opacity=".35" transform="translate(1.5 1.5)"/>`;
  s += line([[20, 22], [30, 20]], C.mintD, 1.6, 'opacity=".5"') + line([[24, 28], [29, 27]], C.mintD, 1.2, 'opacity=".45"');
  s += line([[92, 100], [104, 103]], C.mintD, 1.6, 'opacity=".5"') + line([[96, 108], [101, 109]], C.mintD, 1.2, 'opacity=".4"');
  s += line([[88, 30], [94, 38]], C.mintD, 1.4, 'opacity=".4"');
  return s;
});

const SH = { coral: C.coralD, gold: C.goldD, teal: C.tealD, cream: C.creamD, sky: '#5AA6CE', soda: C.sodaD, blue: C.blueD, green: C.greenD, lavL: C.lav, breadL: C.bread, white: C.creamD };
const PAL = [C.coral, C.gold, C.teal, C.cream, C.sky, C.soda, C.blue, C.green, C.lavL, C.breadL];
function prod(r, x, base, w, h, pal) {
  const col = pal[Math.floor(r() * pal.length)], col2 = pal[Math.floor(r() * pal.length)], k = r(), sh = SH[Object.keys(C).find((q) => C[q] === col)] ?? C.lavD;
  const so = { sw: SWs, dx: 2.5, dy: 0 };
  if (k < 0.4) return shape(jit(rect(x, base - h, w, h), 0.5, x), col, sh, so) + flat(rect(x + 1.5, base - h + 3, w - 4, h * 0.22), col2 === col ? C.cream : col2, 'opacity=".9"') + flat(rect(x + 3, base - h * 0.45, w * 0.45, h * 0.18), C.cream, 'opacity=".8"');
  if (k < 0.65) return can(x + w / 2, base - h + 2, Math.min(w, 17), h - 6, col, sh, col2 === col ? C.cream : col2, { sw: SWs });
  if (k < 0.85) return shape(rect(x + 1, base - h * 0.78, w - 2, h * 0.78), col, sh, so) + shape(rect(x + 2, base - h, w - 4, h * 0.24), col2 === col ? C.gold : col2, null, { sw: SWs }) + flat(rect(x + 4, base - h * 0.55, w - 9, h * 0.25), C.cream, 'opacity=".85"');
  return shape([[x + w * 0.3, base - h], [x + w * 0.7, base - h], [x + w * 0.7, base - h * 0.72], [x + w, base - h * 0.55], [x + w, base], [x, base], [x, base - h * 0.55], [x + w * 0.3, base - h * 0.72]], col, sh, so) + flat(rect(x + w * 0.32, base - h - 2, w * 0.36, 4), col2 === col ? C.gold : col2) + flat(rect(x + 2, base - h * 0.4, w - 5, h * 0.2), C.cream, 'opacity=".85"');
}
function shelfUnit(w, h, { seed, boards, pal = PAL, hdr = 16, kick = 12, up = 12, sign = true, fc = C.lav, fs = C.lavD, bc = C.lavD, bd = '#5B4D86', boardc = C.lavL }) {
  const r = rng(seed), x0 = 2, x1 = w - 2;
  let s = shape(rect(x0, 2, w - 4, h - 4), bc, null, { sw: SW });
  s += flat(rect(x0 + up, hdr + 2, w - 4 - 2 * up, h - hdr - kick - 4), bd);
  boards.forEach((b, i) => {
    const top = i === 0 ? hdr + 8 : boards[i - 1] + 10, maxH = b - top - 2;
    let x = x0 + up + 3;
    while (x < x1 - up - 14) {
      const pw = 12 + Math.floor(r() * 13), ph = Math.min(maxH, 15 + Math.floor(r() * 15));
      if (x + pw > x1 - up - 3) break;
      s += prod(r, x, b + 1, pw, ph, pal);
      x += pw + 1 + Math.floor(r() * 3);
    }
  });
  boards.forEach((b) => {
    s += shape(rect(x0 + up - 3, b, w - 4 - 2 * (up - 3), 9), boardc, fc, { sw: SWs + 0.5, dx: 0, dy: 3 });
    for (let x = x0 + up + 4; x < x1 - up - 22; x += 26 + Math.floor(r() * 8)) s += flat(rect(x, b + 2.5, 15, 4), C.coral) + flat(rect(x + 17, b + 2.5, 3, 4), C.cream);
  });
  s += shape(rect(x0, 2, up, h - 4), fc, fs, { sw: SW, dx: 3, dy: 0 }) + shape(rect(x1 - up, 2, up, h - 4), fc, fs, { sw: SW, dx: 3, dy: 0 });
  s += shape(rect(x0, 2, w - 4, hdr), fc, fs, { sw: SW, dx: 0, dy: 4 });
  for (let x = x0 + up + 6; x < x1 - up - 20; x += 44) s += flat(rect(x, 6, 20, 5), C.coral) + flat(rect(x + 23, 6, 9, 5), C.cream);
  s += shape(rect(x0, h - kick - 2, w - 4, kick), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 3 });
  if (sign) s += flat(rect(x0 + 3, 4, 5, hdr - 4), C.lavL, 'opacity=".6"');
  return s;
}
add('shelf_a', () => inset(256, 150, shelfUnit(256, 150, { seed: 11, boards: [52, 90, 128] })));
add('shelf_b', () => inset(256, 150, shelfUnit(256, 150, { seed: 73, boards: [50, 89, 128], pal: [C.teal, C.coral, C.cream, C.gold, C.blue, C.green, C.sky, C.lavL] })));
add('shelf_side', () => inset(96, 220, shelfUnit(96, 220, { seed: 5, boards: [56, 96, 136, 176], up: 9, hdr: 22, kick: 14 })));

function freezer(kind) {
  const r = rng(kind === 'a' ? 3 : 9);
  let s = shape(rect(2, 2, 252, 146), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 0 });
  s += shape(rect(2, 2, 252, 16), C.lav, C.lavD, { sw: SW, dx: 0, dy: 4 });
  for (let x = 14; x < 230; x += 60) s += flat(rect(x, 7, 26, 5), C.coral) + flat(rect(x + 30, 7, 10, 5), C.cream);
  [6, 90, 174].forEach((dx, di) => {
    s += shape(rect(dx, 21, 76, 114), C.lav, C.lavD, { sw: SW, dx: 3, dy: 0 });
    const gx = dx + 6, gy = 27, gw = 64, gh = 102;
    s += shape(rect(gx, gy, gw, gh), C.frost, C.frostD, { sw: SWs + 0.5, stroke: C.plum, dx: 4, dy: 4 });
    if (kind === 'a') {
      s += flat(rect(gx + 3, gy + 33, gw - 6, 3), C.white, 'opacity=".7"') + flat(rect(gx + 3, gy + 68, gw - 6, 3), C.white, 'opacity=".7"');
      if (di === 1) s += snowflake(gx + gw / 2, gy + 50, 22, C.white, 7) + snowflake(gx + gw / 2, gy + 50, 22, C.sky, 3.2);
      else s += snowflake(gx + 32, gy + 80, 9, C.sky, 3);
      s += flat([[gx, gy + gh], [gx + 16, gy + gh], [gx, gy + gh - 16]], C.white, 'opacity=".8"') + flat([[gx + gw, gy], [gx + gw - 18, gy], [gx + gw, gy + 16]], C.white, 'opacity=".8"');
    } else {
      for (let row = 0; row < 3; row++) {
        const by = gy + 8 + row * 32;
        for (let c = 0; c < 3; c++) {
          const tx = gx + 4 + c * 20, tcol = [C.coral, C.teal, C.gold, C.cream, C.lavL, C.sky][Math.floor(r() * 6)], lcol = [C.cream, C.white, C.lavL, C.coral][Math.floor(r() * 4)];
          s += shape([[tx + 1, by + 6], [tx + 17, by + 6], [tx + 15, by + 26], [tx + 3, by + 26]], tcol, SH[Object.keys(C).find((q) => C[q] === tcol)] ?? C.lavD, { sw: SWs, dx: 3, dy: 0 }) +
            shape(rect(tx - 1, by, 19, 7), lcol, null, { sw: SWs }) + flat(rect(tx + 4, by + 12, 9, 6), C.cream, 'opacity=".85"');
        }
        s += line([[gx, by + 29], [gx + gw, by + 29]], C.chromeD, 2.5);
      }
    }
    s += flat(rect(gx, gy, gw, gh), C.frost, 'opacity=".3"');
    s += flat([[gx + 8, gy], [gx + 26, gy], [gx + 10, gy + gh], [gx, gy + gh]], C.white, 'opacity=".4"') + flat([[gx + 32, gy], [gx + 38, gy], [gx + 22, gy + gh], [gx + 16, gy + gh]], C.white, 'opacity=".28"');
    s += shape(rect(dx + 68, 62, 6, 44), C.chrome, C.chromeD, { sw: SWs, dx: 2, dy: 0 });
  });
  s += shape(rect(2, 136, 252, 12), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 3 });
  return s;
}
add('freezer_a', () => inset(256, 150, freezer('a')));
add('freezer_b', () => inset(256, 150, freezer('b')));

add('prop_cereal', () => {
  const r = rng(21), cols = [C.coral, C.gold, C.teal, C.sky, C.cream, C.lavL];
  let s = shadowE(66, 80, 52, 7, 0.22);
  // spilled loops first (behind box edge), then box
  for (let i = 0; i < 22; i++) {
    const t = r(), x = 96 + t * 38, y = 50 + (r() - 0.4) * 26 + t * 8, col = cols[Math.floor(r() * cols.length)];
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="4.2" fill="none" stroke="${C.plum}" stroke-width="6.4"/>`;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="4.2" fill="none" stroke="${col}" stroke-width="3.4"/>`;
  }
  s += `<g transform="rotate(-6 50 50)">` + prism(8, 36, 70, 36, 22, 14, [C.blue, C.blueD], ['#7FA4E4', C.blue], [C.blueD, '#243F73'], { sw: SW, sdx: 5, sdy: 4 });
  s += shape([[78, 36], [100, 22], [100, 58], [78, 72]], '#241638', null, { sw: SW }) + flat([[78, 36], [94, 24], [90, 28], [78, 42]], C.plumSoft);
  s += shape(star(40, 54, 14, 7, 8), C.gold, C.goldD, { sw: SWs, dx: 1.5, dy: 1.5 }) + shape(ellPath(40, 54, 6, 6), C.coral, null, { sw: 1.5 });
  s += flat([[12, 42], [34, 42], [34, 45], [12, 45]], C.cream, 'opacity=".8"') + flat([[22, 36], [44, 22], [58, 22], [36, 36]], C.cream, 'opacity=".5"') + `</g>`;
  return s;
});

add('prop_wetfloor', () => {
  let s = shadowE(30, 83, 26, 5, 0.25);
  s += shape([[38, 12], [52, 16], [56, 80], [44, 84]], C.goldD, '#A8700F', { sw: SW, dx: 2, dy: 0 });
  s += shape([[10, 14], [40, 12], [46, 84], [3, 84]], C.banana, C.bananaD, { sw: SW, dx: 4, dy: 3 });
  s += shape([[20, 8], [34, 7], [35, 14], [19, 15]], C.banana, C.bananaD, { sw: SWs, dx: 2, dy: 2 }) + flat(rect(23, 10, 8, 2.4), C.plum);
  // slipping figure
  s += `<circle cx="22" cy="31" r="4.4" fill="${C.plum}"/>`;
  s += line([[26, 37], [22, 50], [14, 54]], C.plum, 4) + line([[22, 50], [30, 58], [26, 68]], C.plum, 4) + line([[25, 40], [32, 36]], C.plum, 3.2) + line([[24, 42], [15, 40]], C.plum, 3.2);
  s += line([[11, 74], [34, 74]], C.plum, 2.5) + flat([[12, 18], [22, 17], [16, 28]], C.cream, 'opacity=".45"');
  return s;
});

add('mopbot', () => {
  let s = shadowE(45, 80, 34, 6, 0.28);
  // mop head trailing behind (left), then round body, eye band, antenna
  s += shape([[4, 66], [26, 60], [30, 78], [8, 82]], C.cream, C.creamD, { sw: SWs, dx: 2, dy: 2 });
  for (const x of [9, 14, 19, 24]) s += line([[x, 74], [x - 3, 84]], C.plum, 2);
  s += ell(52, 52, 30, 26, C.teal, C.tealD, { dx: 4, dy: 5 });
  s += shape([[32, 44], [74, 44], [76, 58], [30, 58]], C.plumSoft, null, { sw: SWs });
  s += `<circle cx="60" cy="51" r="5.5" fill="${C.gold}"/><circle cx="46" cy="51" r="5.5" fill="${C.gold}"/><circle cx="61" cy="50" r="2" fill="${C.plum}"/><circle cx="47" cy="50" r="2" fill="${C.plum}"/>`;
  s += line([[52, 28], [52, 16]], C.plum, 3) + `<circle cx="52" cy="14" r="4.5" fill="${C.coral}" stroke="${C.plum}" stroke-width="2"/>`;
  s += flat([[34, 36], [48, 28], [52, 31], [38, 40]], C.white, 'opacity=".45"');
  s += `<circle cx="38" cy="76" r="6" fill="${C.plum}"/><circle cx="68" cy="76" r="6" fill="${C.plum}"/>`;
  return s;
});

add('prop_salesign', () => {
  const cx = 60, cy = 46;
  let s = shadowE(60, 103, 26, 5, 0.25);
  s += shape([[56, 84], [64, 84], [64, 102], [56, 102]], C.chrome, C.chromeD, { sw: SW, dx: 2, dy: 0 });
  s += shape([[44, 98], [76, 98], [80, 105], [40, 105]], C.plumSoft, C.plum, { sw: SWs, dx: 0, dy: 2 });
  const burst = (ro, ri, k) => star(cx, cy, ro, ri, k, -90);
  let b = shape(burst(43, 33, 16), C.coral, C.coralD, { sw: SW, dx: 3, dy: 3 }) + shape(burst(30, 24, 14), C.cream, C.creamD, { sw: SWs, dx: 2, dy: 2 });
  b += `<circle cx="49" cy="35" r="6.5" fill="none" stroke="${C.coral}" stroke-width="5"/><circle cx="71" cy="57" r="6.5" fill="none" stroke="${C.coral}" stroke-width="5"/>`;
  b += line([[73, 29], [47, 63]], C.plum, 9.5) + line([[73, 29], [47, 63]], C.coral, 5.5);
  return s + rot(b, 8, cx, cy);
});

add('prop_cans', () => nudge(0, -3, (() => {
  const pal = [[C.soda, C.sodaD], [C.blue, C.blueD], [C.gold, C.goldD], [C.teal, C.tealD]];
  let s = shadowE(60, 83, 52, 6, 0.25);
  const rows = [[11, [60]], [28, [47, 73]], [45, [34, 60, 86]], [62, [21, 47, 73, 99]]];
  let k = 0;
  for (const [top, xs] of rows) for (const x of xs) { const [a, b] = pal[k++ % 4]; s += can(x, top + 2, 25, 20, a, b, C.cream, { sw: SW - 0.5 }); }
  return s;
})()));

add('entry_marker', () => {
  const chev = (x, y, rotd) => `<g transform="translate(${x} ${y}) rotate(${rotd})">` + shape([[-5, -6], [0, -6], [5, 0], [0, 6], [-5, 6], [0, 0]], C.coral, null, { sw: 1.8 }) + `</g>`;
  return `<ellipse cx="48" cy="24" rx="43" ry="19.5" fill="${C.lav}" opacity=".28"/>` +
    `<ellipse cx="48" cy="24" rx="43" ry="19.5" fill="none" stroke="${C.plum}" stroke-width="3" stroke-dasharray="9 6" stroke-linecap="round"/>` +
    chev(16, 24, 0) + chev(80, 24, 180) + chev(48, 9, 90).replace('rotate(90)', 'rotate(90) scale(1 .8)') + chev(48, 39, -90).replace('rotate(-90)', 'rotate(-90) scale(1 .8)');
});

// =====================================================================================
// FX / PROJECTILES / UI
// =====================================================================================
add('proj_toast', () => {
  const t = [[7, 28], [6, 17], [3, 12], [5, 6], [11, 3], [18, 2], [25, 3], [31, 6], [33, 12], [30, 17], [29, 28]];
  return rot(shape(t, C.bread, C.breadD, { sw: SWs, dx: 2, dy: 2 }) + shape(scalePts(t, 0.72, 18, 15), '#F7D690', '#EDB870', { sw: 1.4, stroke: C.breadD, dx: 1.5, dy: 1.5 }) + flat([[10, 8], [16, 6], [12, 12]], C.white, 'opacity=".8"'), -10, 18, 16);
});
add('proj_nail', () => `<g transform="translate(1.5 .5) scale(.91 .9)">` +
  shape([[1, 1.5], [6, 1.5], [6, 8.5], [1, 8.5]], C.chrome, C.chromeD, { sw: 1.6, dx: 1, dy: 1.5 }) +
  shape([[6, 3.8], [22, 4.2], [27, 5], [22, 5.8], [6, 6.2]], C.chrome, C.chromeD, { sw: 1.5, dx: 0, dy: 1 }) + flat([[8, 4.3], [20, 4.5], [20, 5]], C.white) + '</g>');
add('proj_kernel', () => shape(star(9, 9, 8, 5, 6), '#FFF2B8', C.gold, { sw: 1.8, dx: 0.5, dy: 0.5 }) + flat([[5, 5], [9, 4], [6, 9]], C.white, 'opacity=".8"'));
const rayBolt = (core, mid, glow) => `<ellipse cx="17" cy="7" rx="16" ry="6" fill="${glow}" opacity=".35"/>` +
  `<path d="M2 7 L9 3 L26 4.2 L32 7 L26 9.8 L9 11 Z" fill="${mid}" stroke="${C.plum}" stroke-width="1.4" stroke-linejoin="round"/>` +
  `<path d="M7 7 L12 5.2 L25 5.6 L28 7 L25 8.4 L12 8.8 Z" fill="${core}"/>` +
  `<circle cx="27" cy="7" r="2.6" fill="#FFFFFF"/>`;
add('proj_raybolt', () => rayBolt('#E8FFD0', '#5FD35A', '#8FEF6F'));
add('proj_raybolt_red', () => rayBolt('#FFE0D0', '#F45F52', '#FF8F6F'));
add('proj_bubble', () =>
  `<circle cx="18" cy="18" r="15.5" fill="${C.plum}"/>` + shape(ellPath(18, 18, 14.2, 14.2), '#D8F1FF', '#9FD2EE', { sw: 1.6, dx: 3, dy: 3, stroke: C.plum }) +
  `<path d="M9 14 A10 10 0 0 1 17 8" fill="none" stroke="${C.white}" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="20" r="1.5" fill="${C.white}"/><circle cx="26" cy="24" r="2" fill="${C.coralL}" opacity=".7"/>`);
add('proj_receipt', () => {
  const p = 'M2 6 L8 3 L16 5 L26 3 L33 6 Q38 8 37 13 Q36 18 30 17 L22 18 L12 21 L3 19 Z';
  return shape(p, C.cream, C.creamD, { sw: SWs, dx: 1.5, dy: 2 }) + line([[7, 8], [27, 7]], C.chromeD, 1.4) + line([[7, 12], [30, 11]], C.chromeD, 1.4) + line([[8, 16], [22, 15]], C.chromeD, 1.4) + `<path d="M33 6 Q38 8 37 13 Q36 18 30 17" fill="none" stroke="${C.coral}" stroke-width="1.6"/>`;
});
add('fx_sweep', () => {
  const pt = (rr, deg) => [80 + Math.cos((deg * Math.PI) / 180) * rr, 80 + Math.sin((deg * Math.PI) / 180) * rr];
  const out = [], inn = [], hi = [];
  for (let i = 0; i <= 24; i++) { const t = 105 + (150 * i) / 24, w = Math.cos((((t - 180) / 75) * Math.PI) / 2); out.push(pt(72, t)); inn.push(pt(72 - 24 * w, t)); hi.push(pt(72 - 8 * w, t)); }
  const poly = [...out, ...inn.reverse()];
  return shape(poly, C.cream, C.white, { sw: 3, stroke: C.coral, dx: 0, dy: 0 }).replace(`fill="${C.white}"`, `fill="${C.white}"`) +
    flat([...out.slice(2, 20), ...hi.slice(2, 20).reverse()], C.white, 'opacity=".95"') +
    line([pt(80, 118), pt(86, 130)], C.coral, 3) + line([pt(80, 242), pt(86, 230)], C.coral, 3);
});
add('fx_frost', () => {
  const cx = 128, cy = 128, k = 16;
  let s = `<circle cx="${cx}" cy="${cy}" r="96" fill="none" stroke="${C.frostD}" stroke-width="22" opacity=".55"/><circle cx="${cx}" cy="${cy}" r="96" fill="none" stroke="${C.frost}" stroke-width="16"/><circle cx="${cx}" cy="${cy}" r="100" fill="none" stroke="${C.white}" stroke-width="3" opacity=".9"/>`;
  const r = rng(4);
  for (let i = 0; i < k; i++) {
    const t = (i / k) * Math.PI * 2 + 0.1, L = 10 + r() * 10 + (i % 2) * 4, w = 0.09 + r() * 0.05;
    const p = (rr, a) => [cx + Math.cos(t + a) * rr, cy + Math.sin(t + a) * rr];
    s += shape([p(100, -w), p(100 + L, 0), p(100, w)], C.frost, C.frostD, { sw: 2, stroke: '#4F9CC7', dx: 1.5, dy: 1.5 });
    if (i % 2) s += shape([p(90, -w * 0.9), p(90 - L * 0.7, 0), p(90, w * 0.9)], C.white, null, { sw: 1.6, stroke: '#4F9CC7' });
  }
  return s;
});
add('fx_pulse', () => {
  let s = `<circle cx="128" cy="128" r="100" fill="none" stroke="${C.lav}" stroke-width="7" opacity=".75"/><circle cx="128" cy="128" r="100" fill="none" stroke="${C.white}" stroke-width="2.5" opacity=".95"/><circle cx="128" cy="128" r="112" fill="none" stroke="${C.lavL}" stroke-width="2" opacity=".7"/>`;
  for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2, a = i % 2 ? 116 : 114, b = i % 2 ? 124 : 120; s += line([[128 + Math.cos(t) * a, 128 + Math.sin(t) * a], [128 + Math.cos(t) * b, 128 + Math.sin(t) * b]], C.lav, 3, 'opacity=".85"'); }
  return s;
});
add('fx_spark', () => shape(star(8, 8, 6.4, 1.7, 4, -90), C.gold, null, { sw: 1.2, stroke: C.goldD }) + flat(star(8, 8, 4.6, 1.2, 4, -90), C.white));
add('fx_flame', () => `<g transform="translate(12 12) scale(.88) translate(-12 -12)">` +
  shape('M12 22 C4 21 3 13 8 8 C9 11 11 11 11 7 C12 4 12 2 12 1 C18 5 21 11 20 16 C19 20 16 22 12 22Z', '#F48A3A', '#E2602C', { sw: 1.6, dx: 2, dy: 1.5 }) +
  flat('M12 21 C8 20 8 15 11 12 C12 14 14 14 14 17 C15 15 16 14 16 16 C16 19 14 21 12 21Z', C.gold) + flat('M12 21 C10 20 10 18 12 16 C14 18 14 20 12 21Z', C.cream) + '</g>');
add('fx_puff', () => {
  const cs = [[16, 28, 11], [30, 28, 11], [24, 18, 12], [34, 20, 8], [12, 21, 7]];
  return cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 1.5}" fill="${C.plum}"/>`).join('') +
    cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.creamD}"/>`).join('') +
    cs.map(([x, y, r]) => `<circle cx="${x - 1.5}" cy="${y - 2}" r="${r - 2.5}" fill="${C.cream}"/>`).join('') + flat('M14 14 Q18 10 22 11 Q18 12 16 16Z', C.white, 'opacity=".9"');
});
add('fx_receipt_burst', () => {
  const zz = (x0, x1, y, amp, k) => { const o = []; for (let i = 0; i <= k; i++) o.push([x0 + ((x1 - x0) * i) / k, y + (i % 2 ? amp : -amp)]); return o; };
  const top = zz(8, 90, 12, 4, 14), bot = zz(90, 8, 52, 4, 14);
  return rot(shape([...top, ...bot], C.cream, C.creamD, { sw: SW, dx: 3, dy: 3 }) +
    shape([...zz(8, 90, 17, 3, 14), ...zz(90, 8, 25, 3, 14)], C.coral, null, { sw: 0 }).replace('stroke-width="0"', 'stroke-width="0"') +
    [31, 36, 41, 46].map((y, i) => line([[16, y], [60 + i * 8, y - 1]], C.chromeD, 2.2)).join('') + flat([[14, 28], [30, 28], [24, 31]], C.white, 'opacity=".8"'), -6, 48, 32);
});
add('fx_crumb', () => `<g transform="translate(6 6) scale(.85) translate(-6 -6)">` + shape([[2, 8], [3, 3], [8, 1.5], [10.5, 6], [8, 10.5], [4, 10.5]], C.bread, C.breadD, { sw: 1.4, dx: 1.3, dy: 1.3 }) + flat([[4, 4], [7, 3.2], [5, 6.5]], C.breadL) + '</g>');
add('coin', () =>
  `<circle cx="14" cy="14" r="11.8" fill="${C.gold}" stroke="${C.plum}" stroke-width="2.4"/>` +
  `<circle cx="14" cy="14" r="9.4" fill="${C.goldD}"/><circle cx="13" cy="13" r="8.6" fill="${C.gold}"/>` +
  shape(star(14, 14.5, 5.8, 2.6, 5), C.goldD, null, { sw: 1.4, stroke: C.plum }) + `<path d="M5.5 11 A9 9 0 0 1 11 5.5" fill="none" stroke="#FFE08A" stroke-width="1.8" stroke-linecap="round"/>`);
const HEART = 'M16 28 L5 16 Q0 9 4.5 4.5 Q10 0 16 7 Q22 0 27.5 4.5 Q32 9 27 16 Z';
add('heart', () => `<g transform="translate(16 15) scale(.94) translate(-16 -15)">` + shape(HEART, C.coral, C.coralD, { sw: 2.4, dx: 3, dy: 3 }) + flat('M6 8 Q8 4.5 12 5 Q8 6 8 10Z', C.cream, 'opacity=".95"') + '</g>');
add('heart_empty', () => `<g transform="translate(16 15) scale(.94) translate(-16 -15)"><path d="${HEART}" fill="${C.lav}" fill-opacity=".4" stroke="${C.plum}" stroke-width="2.4" stroke-linejoin="round"/></g>`);

// =====================================================================================
// EXTRA ITEMS + WEAPON FX
// =====================================================================================
add('icon_microwave', () => {
  const x = 22, y = 86, w = 116, h = 62, dx = 28, dy = 20;
  let s = prism(x, y, w, h, dx, dy, [C.cream, C.creamD], [C.white, C.cream], [C.creamD, C.lav], { sw: SWi, sdx: 7, sdy: 5 });
  s += shape(rect(x + 9, y + 9, 70, 44), '#241638', '#1B1127', { sw: 4, dx: -3, dy: -3 });
  s += ell(x + 44, y + 38, 26, 8, C.gold, C.goldD, { sw: 3, dx: 2, dy: 2 });
  s += `<ellipse cx="${x + 44}" cy="${y + 35}" rx="17" ry="4.5" fill="#FFE08A" opacity=".9"/>`;
  s += flat([[x + 12, y + 12], [x + 34, y + 12], [x + 12, y + 30]], C.lavL, 'opacity=".45"');
  s += shape(rect(x + 86, y + 9, 22, 44), C.coral, C.coralD, { sw: 3, dx: 3, dy: 3 });
  s += `<circle cx="${x + 97}" cy="${y + 22}" r="6.5" fill="${C.cream}" stroke="${C.plum}" stroke-width="3"/>` + line([[x + 97, y + 22], [x + 97, y + 17]], C.plum, 2.5);
  s += shape(rect(x + 90, y + 34, 14, 6), C.gold, null, { sw: 2.5 }) + shape(rect(x + 90, y + 43, 14, 6), C.cream, null, { sw: 2.5 });
  s += shape(rect(x + 6, y + h, 16, 7), C.plum, null, { sw: 3 }) + shape(rect(x + w - 22, y + h, 16, 7), C.plum, null, { sw: 3 });
  return icon(s, 164);
});

add('icon_blender', () => {
  let s = prism(58, 130, 72, 32, 14, 10, [C.coral, C.coralD], [C.coralL, C.coral], [C.coralD, '#8F2D2C'], { sw: SWi, sdx: 5, sdy: 4 });
  s += `<circle cx="78" cy="146" r="5" fill="${C.gold}" stroke="${C.plum}" stroke-width="3"/><circle cx="96" cy="146" r="5" fill="${C.cream}" stroke="${C.plum}" stroke-width="3"/><circle cx="114" cy="146" r="5" fill="${C.gold}" stroke="${C.plum}" stroke-width="3"/>`;
  s += S5([[56, 34], [136, 34], [124, 130], [68, 130]], '#C9F1EA', '#92D6CB', { dx: 8, dy: 0 });
  s += flat([[66, 80], [126, 80], [122, 126], [70, 126]], C.teal, 'opacity=".35"');
  s += flat([[64, 42], [74, 42], [80, 124], [74, 124]], C.white, 'opacity=".85"');
  s += shape([[84, 118], [100, 108], [118, 116], [104, 124]], C.chrome, C.chromeD, { sw: 3, dx: 2, dy: 2 }) + shape([[90, 104], [96, 96], [104, 112]], C.chrome, C.chromeD, { sw: 3 }) + shape([[96, 126], [92, 130], [110, 128]], C.chrome, null, { sw: 2.5 });
  s += S5([[52, 18], [140, 18], [138, 36], [54, 36]], C.coral, C.coralD, { dx: 0, dy: 4 });
  s += shape(rect(84, 6, 24, 14), C.coralD, null, { sw: 4 });
  s += line([[40, 60], [32, 54]], C.coral, 4) + line([[40, 76], [30, 76]], C.coral, 4) + line([[152, 60], [160, 54]], C.coral, 4) + line([[152, 76], [162, 76]], C.coral, 4);
  return icon(s, 172);
});

add('icon_fizz', () => {
  let s = S5([[46, 172], [132, 172], [120, 132], [58, 132]], C.coral, C.coralD, { dx: 6, dy: 0 });
  s += S5([[40, 172], [140, 172], [140, 180], [40, 180]], C.plumSoft, C.plum, { dx: 0, dy: 3, sw: 4 }).replace(/<path/, '<path opacity="0"');
  let g = S5([[16, 84], [96, 76], [124, 88], [156, 90], [156, 110], [124, 112], [96, 124], [16, 116]], C.green, C.greenD, { dx: 0, dy: 7 });
  g += flat([[22, 88], [94, 81], [94, 86], [24, 94]], C.greenL, 'opacity=".9"');
  g += shape([[40, 88], [80, 86], [80, 112], [40, 114]], C.cream, C.creamD, { sw: 3.5, dx: 3, dy: 3 }) + shape(star(60, 100, 9, 4, 5), C.coral, null, { sw: 2 });
  g += shape(rect(150, 86, 10, 28), C.chrome, C.chromeD, { sw: 3.5, dx: 2, dy: 0 });
  s += rot(g, -30, 90, 104);
  // flying cap + foam burst
  s += `<g transform="rotate(25 172 30)">` + shape(rect(160, 22, 24, 12), C.gold, C.goldD, { sw: 4, dx: 0, dy: 3 }) + `</g>`;
  s += line([[160, 44], [152, 56]], C.coral, 4) + line([[180, 52], [184, 62]], C.coral, 4);
  const foam = [[146, 76, 11], [160, 70, 9], [140, 62, 9], [156, 56, 8], [128, 70, 7], [168, 84, 6]];
  s += foam.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2.5}" fill="${C.plum}"/>`).join('') + foam.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.white}"/>`).join('') + foam.map(([x, y, r]) => `<circle cx="${x + r * 0.3}" cy="${y + r * 0.35}" r="${r * 0.6}" fill="${C.frost}" opacity=".7"/>`).join('');
  return icon(s, 176);
});

add('icon_mop', () => {
  let s = shape([[22, 8], [32, 4], [108, 80], [100, 90]], C.breadL, C.breadD, { sw: 4.5, dx: 3, dy: 3 });
  s += flat([[28, 10], [32, 8], [100, 82], [98, 82]], C.cream, 'opacity=".6"');
  const fan = [66, 76, 88, 100, 112, 124, 136, 146];
  s += fan.map((x, i) => line([[96 + i * 3, 90], [x + (i - 3.5) * 2, 134]], C.plum, 11)).join('');
  s += fan.map((x, i) => line([[96 + i * 3, 90], [x + (i - 3.5) * 2, 134]], i % 2 ? C.cream : '#FFF8E6', 6.5)).join('');
  s += S5([[88, 80], [128, 82], [126, 98], [90, 98]], C.chrome, C.chromeD, { dx: 0, dy: 4, sw: 4 });
  s += S5([[62, 122], [160, 122], [148, 172], [74, 172]], C.banana, C.bananaD, { dx: 8, dy: 3 });
  s += S5([[56, 116], [166, 116], [166, 130], [56, 130]], C.banana, C.bananaD, { dx: 0, dy: 5 });
  s += flat([[68, 136], [78, 136], [84, 166], [80, 166]], '#FFF0A0', 'opacity=".8"');
  // wringer
  s += S5(rect(160, 126, 18, 34), C.chrome, C.chromeD, { dx: 4, dy: 0, sw: 4 });
  s += line([[169, 134], [169, 152]], C.chromeD, 3) + tube([[172, 124], [182, 104]], 4, C.coral, 3);
  return icon(s, 176);
});

add('icon_pricegun', () => {
  let s = S5([[24, 56], [142, 52], [142, 88], [24, 90]], C.coral, C.coralD, { dx: 6, dy: 6 });
  s += `<path d="M30 56 A21 21 0 0 1 72 56 Z" fill="${C.cream}" stroke="${C.plum}" stroke-width="5" stroke-linejoin="round" transform="translate(0 -8)"/>`;
  s += `<circle cx="51" cy="48" r="5" fill="${C.plum}"/>` + line([[51, 48], [51, 36]], C.coralL, 3);
  s += S5([[142, 58], [160, 62], [160, 86], [142, 86]], C.chrome, C.chromeD, { dx: 3, dy: 3 });
  s += S5([[34, 88], [76, 88], [68, 158], [28, 158]], C.coral, C.coralD, { dx: 6, dy: 0 });
  s += S5([[80, 94], [104, 94], [106, 126], [94, 144], [80, 124]], C.gold, C.goldD, { dx: 4, dy: 3, sw: 4.5 });
  s += S5(rect(26, 148, 46, 14), C.plumSoft, C.plum, { dx: 0, dy: 3, sw: 4 });
  s += flat([[28, 60], [120, 57], [120, 61], [30, 65]], C.coralL, 'opacity=".8"') + shape(rect(86, 66, 34, 14), C.cream, C.creamD, { sw: 3, dx: 2, dy: 2 });
  // strip of price tags out the front
  for (let i = 0; i < 3; i++) {
    const x = 160 + i * 9;
    s += shape(rect(x, 64, 9.5, 22), C.cream, C.creamD, { sw: 3, dx: 1.5, dy: 2 });
  }
  for (let i = 0; i < 3; i++) s += `<circle cx="${164.5 + i * 9}" cy="75" r="2.4" fill="${C.coral}"/>`;
  return icon(s, 172);
});

add('icon_tape', () => {
  let s = ell(100, 100, 58, 62, C.chromeD, '#7C8599', { sw: SWi, dx: 0, dy: 0 });
  s += ell(84, 96, 58, 62, C.chrome, C.chromeD, { sw: SWi, dx: 6, dy: 6 });
  s += ell(84, 96, 26, 28, '#4A3560', '#30203F', { sw: 4, dx: -3, dy: -3 });
  s += `<path d="M44 70 A46 50 0 0 1 80 46" fill="none" stroke="${C.white}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
  s += `<ellipse cx="84" cy="96" rx="42" ry="45" fill="none" stroke="${C.chromeD}" stroke-width="2" opacity=".7"/>`;
  s += S5([[96, 148], [150, 150], [160, 166], [150, 172], [140, 164], [128, 172], [116, 164], [104, 170], [92, 160]], C.chrome, C.chromeD, { dx: 0, dy: 5, sw: 4 });
  s += flat([[100, 152], [146, 154], [144, 156], [100, 155]], C.white, 'opacity=".8"');
  return icon(s, 176);
});

add('icon_coupon', () => {
  const page = (deg, fill, sh) => rot(shape(rect(52, 28, 92, 116), fill, sh, { sw: SWi - 1, dx: 4, dy: 4 }), deg, 96, 150);
  let s = page(-16, C.creamD, C.lav) + page(-6, C.cream, C.creamD);
  let top = shape(rect(52, 28, 92, 116), C.cream, C.creamD, { sw: SWi, dx: 5, dy: 5 });
  top += shape(rect(52, 28, 14, 116), C.coral, C.coralD, { sw: SWi, dx: 3, dy: 0 });
  top += `<rect x="74" y="38" width="62" height="96" fill="none" stroke="${C.coralD}" stroke-width="3" stroke-dasharray="7 5"/>`;
  top += `<circle cx="90" cy="64" r="9" fill="none" stroke="${C.coral}" stroke-width="6.5"/><circle cx="120" cy="106" r="9" fill="none" stroke="${C.coral}" stroke-width="6.5"/>`;
  top += line([[124, 56], [86, 114]], C.plum, 12) + line([[124, 56], [86, 114]], C.coral, 7);
  top += flat(rect(78, 120, 34, 5), C.chromeD) + flat(rect(78, 128, 22, 4), C.chromeD);
  s += rot(top, 6, 96, 150);
  return icon(s, 166);
});

add('icon_expiredcoupon', () => {
  let s = shape(rect(34, 44, 112, 76), C.cream, C.creamD, { sw: SWi, dx: 6, dy: 6 });
  s += shape(rect(34, 44, 16, 76), C.gold, C.goldD, { sw: SWi, dx: 3, dy: 0 });
  s += `<rect x="58" y="54" width="80" height="56" fill="none" stroke="${C.goldD}" stroke-width="3" stroke-dasharray="7 5"/>`;
  s += flat(rect(64, 66, 48, 6), C.chromeD) + flat(rect(64, 78, 32, 5), C.chromeD);
  s += flat([[40, 48], [72, 46], [44, 58]], GL, 'opacity=".7"');
  // red "expired" stamp across the coupon
  s += rot(`<rect x="52" y="84" width="92" height="30" rx="3" fill="none" stroke="${C.coral}" stroke-width="5"/>` + line([[64, 99], [132, 99]], C.coral, 9), -14, 98, 99);
  s += spk(160, 36, 11) + spk(24, 140, 7) + spk(40, 30, 5);
  return icon(s, 166);
});

add('icon_barter', () => {
  // rubber stamp (wooden knob, handle, base) over a haggled coin trail
  let s = S5(rect(46, 138, 104, 14), C.chrome, C.chromeD, { dx: 4, dy: 3 });
  s += S5(rect(60, 112, 76, 26), C.coral, C.coralD, { dx: 5, dy: 4 });
  s += S5(rect(84, 56, 28, 56), C.cream, C.creamD, { dx: 4, dy: 3 });
  s += ell(98, 44, 26, 18, C.coral, C.coralD, { sw: SWi, dx: 4, dy: 4 });
  s += flat([[78, 36], [92, 30], [84, 44]], C.white, 'opacity=".7"');
  s += ell(52, 160, 14, 6, C.gold, C.goldD, { sw: 3, dx: 1, dy: 1 }) + ell(148, 160, 14, 6, C.gold, C.goldD, { sw: 3, dx: 1, dy: 1 });
  s += spk(156, 62, 10) + spk(36, 96, 6);
  return icon(s, 170);
});

add('icon_binder', () => {
  // ring binder with a gold corner, a card peeking out
  let s = S5(rect(52, 22, 92, 128), C.cream, C.creamD, { dx: 5, dy: 4 });
  s += S5(rect(40, 32, 100, 132), C.coral, C.coralD, { dx: 8, dy: 6 });
  s += flat(rect(40, 32, 14, 132), C.coralD);
  s += [54, 86, 118].map((y) => ell(46, y, 9, 7, C.chrome, C.chromeD, { sw: 3.5, dx: 1, dy: 1 })).join('');
  s += S5(rect(70, 60, 54, 44), C.cream, C.creamD, { dx: 3, dy: 3, sw: 3.5 });
  s += spk(97, 82, 13);
  s += flat([[64, 40], [96, 38], [66, 52]], C.white, 'opacity=".5"');
  s += S5([[118, 152], [140, 152], [140, 130]], C.gold, C.goldD, { dx: 1, dy: 1, sw: 3.5 });
  return icon(s, 172);
});

add('icon_bubblewrap', () => {
  const A = [30, 62], B = [150, 48], Cc = [166, 128], Dd = [42, 146];
  const bil = (u, v) => [A[0] * (1 - u) * (1 - v) + B[0] * u * (1 - v) + Cc[0] * u * v + Dd[0] * (1 - u) * v, A[1] * (1 - u) * (1 - v) + B[1] * u * (1 - v) + Cc[1] * u * v + Dd[1] * (1 - u) * v];
  let s = S5([A, B, Cc, Dd], C.frost, '#A9DDF0', { dx: 6, dy: 6 });
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
    const [x, y] = bil((i + 0.5) / 6, (j + 0.5) / 4);
    if (i === 5 && j === 3) continue;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="9.5" fill="#E8F9FF" stroke="${C.frostD}" stroke-width="3"/><path d="M${n(x - 5)} ${n(y - 1)} A5.5 5.5 0 0 1 ${n(x)} ${n(y - 5.5)}" fill="none" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  s += shape([Cc, [Cc[0] - 40, Cc[1] + 2], [Cc[0] - 10, Cc[1] - 38]], '#8CCDE6', '#5FA9CB', { sw: 4, dx: 3, dy: 3 });
  s += flat([[Cc[0] - 10, Cc[1] - 30], [Cc[0] - 30, Cc[1] - 2], [Cc[0] - 14, Cc[1] - 8]], C.white, 'opacity=".6"');
  return icon(s, 164);
});

add('icon_energy', () => {
  const LIME = '#9BE04A', LIMED = '#6EB52A';
  let s = can(96, 36, 70, 116, LIME, LIMED, C.plum, { sw: SWi });
  s += `<ellipse cx="108" cy="36" rx="9" ry="3.5" fill="${C.chromeD}" stroke="${C.plum}" stroke-width="2.5"/>`;
  const bolt = [[0, -30], [-18, 4], [-4, 4], [-10, 32], [18, -8], [4, -8], [14, -30]].map(([a, b]) => [96 + a * 0.95, 98 + b]);
  s += shape(bolt, C.lime ?? '#C8F46A', null, { sw: 4 }) + flat([bolt[0], bolt[1], [bolt[1][0] + 7, bolt[1][1]]], C.white, 'opacity=".6"');
  s += flat([[68, 56], [75, 56], [75, 144], [70, 140]], '#D4F79A', 'opacity=".8"');
  for (const [x, y, r] of [[116, 60, 3.6], [122, 78, 2.8], [112, 124, 3.4], [80, 134, 2.6]]) s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.3}" fill="${C.frost}" stroke="${C.plum}" stroke-width="1.6" opacity=".95"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.5}" r="${r * 0.35}" fill="${C.white}"/>`;
  return icon(s, 176);
});

add('icon_fortune', () => {
  // folded cookie with the paper slip sticking out
  const ck = [[24, 118], [44, 70], [96, 46], [148, 70], [168, 118], [136, 108], [114, 132], [96, 104], [78, 132], [56, 108]];
  let s = S5(ck, C.breadL, C.bread, { dx: 7, dy: 7 });
  s += line([[96, 104], [96, 56]], C.breadD, 4);
  s += flat([[46, 76], [92, 54], [92, 62], [52, 84]], C.cream, 'opacity=".75"');
  const slip = [[100, 92], [170, 58], [178, 74], [108, 108]];
  s += shape(slip, C.white, C.creamD, { sw: 4, dx: 2, dy: 3 });
  for (const [x, y] of [[124, 88], [138, 81], [152, 74]]) s += `<circle cx="${x}" cy="${y}" r="3.6" fill="${C.coral}"/>`;
  for (const [x, y] of [[40, 108], [70, 92], [148, 98]]) s += `<circle cx="${x}" cy="${y}" r="2.6" fill="${C.breadD}" opacity=".7"/>`;
  return icon(s, 156);
});

add('icon_sample', () => {
  // cheese cube on a toothpick, little plate, a green heart for the heal
  let s = ell(92, 150, 64, 15, C.white, C.creamD, { sw: SWi });
  const cube = [[50, 100], [92, 86], [130, 100], [130, 140], [90, 156], [50, 140]];
  s += S5(cube, C.gold, C.goldD, { dx: 7, dy: 7 });
  s += flat([[50, 100], [92, 86], [130, 100], [90, 114]], '#FFDA7A');
  s += line([[90, 114], [90, 156]], C.goldD, 3) + line([[50, 100], [90, 114], [130, 100]], C.plum, 3);
  for (const [x, y, r] of [[68, 126, 6], [108, 132, 5], [98, 98, 4], [72, 100, 3]]) s += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${C.goldD}"/>`;
  s += line([[92, 104], [112, 34]], C.plum, 9) + line([[92, 104], [112, 34]], C.breadL, 4.5);
  const heart = [[150, 74], [128, 54], [126, 42], [134, 32], [146, 34], [150, 40], [154, 34], [166, 32], [174, 42], [172, 54]];
  s += shape(heart, C.green, C.greenD, { sw: 4, dx: 3, dy: 3 }) + flat([[132, 40], [140, 36], [134, 48]], C.white, 'opacity=".7"');
  return icon(s, 166);
});

add('icon_piggy', () => {
  // pink piggy bank, coin dropping into the slot
  const PINK = '#F7A6B8', PINKD = '#D9748B';
  let s = '';
  for (const x of [58, 86, 112, 136]) s += S5(rect(x - 8, 128, 18, 26), PINK, PINKD, { dx: 3, dy: 0, sw: 4 });
  s += ell(96, 110, 64, 44, PINK, PINKD, { sw: SWi, dx: 7, dy: 7 });
  s += S5([[54, 76], [62, 52], [80, 70]], PINK, PINKD, { dx: 2, dy: 2, sw: 4 }); // ear
  s += ell(156, 112, 15, 18, '#FBC3CF', PINKD, { sw: 4, dx: 2, dy: 2 }); // snout
  s += `<ellipse cx="152" cy="108" rx="2.6" ry="4" fill="${C.plum}"/><ellipse cx="160" cy="108" rx="2.6" ry="4" fill="${C.plum}"/>`;
  s += `<circle cx="128" cy="92" r="5" fill="${C.plum}"/><circle cx="126.5" cy="90.5" r="1.6" fill="${C.white}"/>`;
  s += line([[30, 104], [22, 96], [30, 90]], C.plum, 4); // tail
  s += line([[78, 70], [108, 70]], C.plum, 6); // coin slot
  s += ell(93, 42, 16, 16, C.gold, C.goldD, { sw: 4, dx: 2, dy: 2 }) + flat([[86, 34], [92, 32], [88, 44]], C.white, 'opacity=".7"');
  s += flat([[50, 96], [70, 80], [72, 86], [54, 102]], C.white, 'opacity=".5"');
  return icon(s, 160);
});

add('icon_expiredmilk', () => {
  // green-tinted milk carton, skull label, EXP sticker, stink waves rising off it
  const MG = '#D6EDB0', MGD = '#A3C874', STINK = '#8FCB57';
  let s = '';
  for (const x of [68, 96, 124]) s += line([[x, 50], [x - 9, 38], [x + 7, 26], [x - 3, 12]], STINK, 5);
  s += S5([[58, 88], [134, 88], [134, 160], [58, 160]], MG, MGD, { dx: 7, dy: 6 });
  s += S5([[58, 88], [96, 58], [134, 88]], MGD, '#7FA84C', { dx: 3, dy: 3 });
  s += flat(rect(58, 112, 76, 30), STINK);
  s += ell(96, 126, 13, 11, C.white, C.creamD, { sw: 3 }) + `<circle cx="91" cy="124" r="3.2" fill="${C.plum}"/><circle cx="101" cy="124" r="3.2" fill="${C.plum}"/>`;
  s += line([[91, 134], [91, 139], [96, 139], [96, 134], [96, 139], [101, 139], [101, 134]], C.plum, 2);
  s += shape(star(132, 96, 20, 14, 10, -90), C.coral, C.coralD, { sw: 3.5, dx: 2, dy: 2 });
  s += flat(rect(121, 94, 4, 8), C.cream) + flat(rect(127, 94, 10, 3), C.cream) + flat(rect(127, 98.5, 8, 3), C.cream) + flat(rect(127, 103, 10, 3), C.cream);
  s += flat([[64, 94], [71, 94], [71, 154], [66, 150]], C.white, 'opacity=".5"');
  return icon(s, 172);
});

add('icon_tinfoilhat', () => {
  // crinkled tin-foil cone hat: silver facets, bright highlights, brim
  const FL = '#C9D0DC', FLD = '#8B95A8', FLL = '#F4F7FC';
  let s = '';
  s += S5([[34, 140], [96, 22], [158, 140]], FL, FLD, { dx: 8, dy: 6 });
  s += flat([[96, 22], [70, 82], [96, 70]], FLL);
  s += flat([[96, 70], [70, 82], [58, 140], [92, 118]], FL);
  s += flat([[96, 22], [124, 90], [104, 84]], FLD, 'opacity=".55"');
  s += flat([[104, 84], [124, 90], [150, 140], [112, 124]], FLD, 'opacity=".4"');
  s += line([[96, 22], [92, 118]], FLD, 2.5) + line([[96, 22], [124, 90], [112, 124]], FLD, 2.5) + line([[70, 82], [58, 140]], FLD, 2.5) + line([[70, 82], [92, 118]], FLD, 2.5);
  s += ell(96, 142, 70, 15, FL, FLD, { sw: SWi, dx: 0, dy: 6 });
  s += flat([[46, 140], [76, 136], [70, 142], [48, 144]], FLL);
  s += flat([[84, 38], [90, 34], [80, 62]], C.white, 'opacity=".9"');
  s += spark(142, 54, 9, C.white) + spark(52, 100, 6, C.white);
  return icon(s, 164);
});

add('icon_jellybeans', () => {
  // glass jar of multicolored jelly beans
  let s = '';
  s += S5([[46, 54], [146, 54], [158, 76], [158, 154], [34, 154], [34, 76]], '#E4F4F8', '#B7DCE6', { dx: 7, dy: 0 });
  const beans = [[58, 138, C.coral], [82, 140, C.gold], [108, 138, C.green], [134, 138, C.sky], [70, 118, C.green], [96, 120, C.coral], [122, 118, C.gold], [52, 102, C.sky], [80, 100, C.gold], [108, 100, C.sky], [136, 102, C.coral], [66, 82, C.coral], [94, 80, C.green], [122, 82, '#B987E8']];
  beans.forEach(([x, y, col], i) => { s += rot(ell(x, y, 12, 8, col, C.plum, { sw: 3 }) + flat([[x - 6, y - 4], [x, y - 5], [x - 5, y - 1]], C.white, 'opacity=".7"'), (i * 47) % 120 - 60, x, y); });
  s += flat([[42, 70], [50, 70], [48, 148], [42, 142]], C.white, 'opacity=".5"');
  s += S5(rect(42, 38, 108, 20), C.coral, C.coralD, { dx: 0, dy: 5, sw: 4 });
  return icon(s, 164);
});

add('proj_cap', () => {
  const k = 12, pts = [];
  for (let i = 0; i < k * 2; i++) { const t = (i * Math.PI) / k, r = i % 2 ? 10.2 : 12; pts.push([14 + Math.cos(t) * r, 14 + Math.sin(t) * r]); }
  return shape(pts, C.gold, C.goldD, { sw: 2, dx: 2, dy: 2 }) + `<circle cx="14" cy="14" r="7" fill="${C.goldD}" opacity=".55"/><circle cx="13" cy="13" r="6" fill="${C.gold}"/><path d="M7 11 A8 8 0 0 1 12 6.5" fill="none" stroke="#FFE08A" stroke-width="2" stroke-linecap="round"/>`;
});

add('fx_zap', () => {
  const b = [[24, 2], [48, 2], [36, 44], [54, 46], [34, 96], [48, 98], [30, 157], [22, 108], [10, 110], [28, 60], [12, 58]];
  return shape(b, C.gold, C.goldD, { sw: 2.5, dx: 3, dy: 0 }) + flat(scalePts(b, 0.45, 30, 80), C.white, 'opacity=".95"') + flat([[28, 6], [36, 6], [30, 22]], C.white, 'opacity=".7"');
});

add('fx_zap_burst', () => {
  let s = `<ellipse cx="80" cy="50" rx="58" ry="27" fill="${C.cream}" opacity=".3"/>`;
  s += `<ellipse cx="80" cy="50" rx="58" ry="27" fill="none" stroke="${C.plum}" stroke-width="20"/><ellipse cx="80" cy="50" rx="58" ry="27" fill="none" stroke="${C.gold}" stroke-width="14"/><ellipse cx="80" cy="50" rx="58" ry="27" fill="none" stroke="${C.cream}" stroke-width="5"/>`;
  const r = rng(6);
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2 + 0.2, L = 14 + r() * 8, c = Math.cos(t), sn = Math.sin(t) * 0.5;
    const p = (rr, o) => [80 + c * rr * 1 + -sn * o * 0.5, 50 + sn * rr + c * o * 0.4];
    const zz = [p(60, 0), p(60 + L * 0.4, 5), p(60 + L * 0.7, -4), p(60 + L, 2)].map(([x, y]) => [x * 1, y]);
    s += line(zz, C.plum, 6.5) + line(zz, C.gold, 3.2);
  }
  return s;
});

const puddlePts = (cx, cy, rx, ry, seed) => { const r = rng(seed), o = []; for (let i = 0; i < 14; i++) { const t = (i / 14) * Math.PI * 2, k = 0.9 + r() * 0.16; o.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); } return o; };
const smooth = (pts) => { const m = pts.length; let d = `M${n((pts[0][0] + pts[m - 1][0]) / 2)} ${n((pts[0][1] + pts[m - 1][1]) / 2)}`; for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % m]; d += `Q${n(a[0])} ${n(a[1])} ${n((a[0] + b[0]) / 2)} ${n((a[1] + b[1]) / 2)}`; } return d + 'Z'; };
add('fx_puddle', () => {
  const pd = smooth(puddlePts(80, 52, 72, 36, 8)), pd2 = smooth(puddlePts(80, 50, 52, 25, 3));
  let s = `<path d="${pd}" fill="#BFD8F2" fill-opacity=".72" stroke="${C.plumSoft}" stroke-opacity=".55" stroke-width="2.5"/><path d="${pd2}" fill="${C.lav}" fill-opacity=".3"/>`;
  s += `<path d="M30 40 Q44 28 70 26" fill="none" stroke="${C.white}" stroke-opacity=".9" stroke-width="4" stroke-linecap="round"/>`;
  for (const [x, y, r] of [[110, 46, 9], [124, 58, 6], [96, 62, 7], [58, 60, 5], [134, 44, 4], [84, 40, 4]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.white}" fill-opacity=".55" stroke="${C.white}" stroke-width="2"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="${C.white}"/>`;
  return s;
});
add('fx_puddle_fire', () => {
  const pd = smooth(puddlePts(80, 64, 72, 30, 8)), pd2 = smooth(puddlePts(80, 63, 52, 20, 3));
  let s = `<path d="${pd}" fill="#F5A33A" fill-opacity=".8" stroke="${C.coralD}" stroke-opacity=".7" stroke-width="2.5"/><path d="${pd2}" fill="${C.gold}" fill-opacity=".75"/>`;
  const fl = (x, y, h, w) => shape(`M${x} ${y} C${x - w} ${y - h * 0.3} ${x - w * 0.6} ${y - h * 0.7} ${x - w * 0.1} ${y - h} C${x} ${y - h * 0.6} ${x + w * 0.2} ${y - h * 0.5} ${x + w * 0.4} ${y - h * 0.6} C${x + w * 1.1} ${y - h * 0.4} ${x + w} ${y - h * 0.1} ${x} ${y}Z`, '#F48A3A', '#E2602C', { sw: 1.8, dx: 2, dy: 1.5 }) +
    flat(`M${x} ${y - 1} C${x - w * 0.6} ${y - h * 0.2} ${x - w * 0.3} ${y - h * 0.5} ${x - w * 0.05} ${y - h * 0.62} C${x + w * 0.1} ${y - h * 0.4} ${x + w * 0.5} ${y - h * 0.3} ${x} ${y - 1}Z`, C.gold) + flat(`M${x} ${y - 1} C${x - w * 0.3} ${y - h * 0.15} ${x - w * 0.1} ${y - h * 0.3} ${x} ${y - h * 0.34} C${x + w * 0.25} ${y - h * 0.15} ${x + w * 0.2} ${y - 2} ${x} ${y - 1}Z`, C.cream);
  for (const [x, y, h, w] of [[18, 66, 24, 12], [34, 78, 30, 14], [54, 88, 34, 16], [80, 91, 44, 18], [106, 88, 32, 15], [126, 78, 28, 14], [142, 66, 22, 11], [92, 44, 26, 12], [60, 46, 22, 11]]) s += fl(x, y, h, w);
  return s;
});

add('fx_blades', () => {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const a0 = i * 90, pt = (rr, deg) => [100 + Math.cos((deg * Math.PI) / 180) * rr, 100 + Math.sin((deg * Math.PI) / 180) * rr];
    const out = [], inn = [];
    for (let k = 0; k <= 14; k++) { const p = k / 14, t = a0 + p * 62, w = 26 * Math.pow(Math.sin(Math.PI * Math.min(1, p * 0.9 + 0.08)), 0.8); out.push(pt(84, t)); inn.push(pt(84 - w, t)); }
    const trail = []; for (let k = 0; k <= 10; k++) trail.push(pt(76, a0 - 40 + (k / 10) * 40));
    const trail2 = []; for (let k = 0; k <= 10; k++) trail2.push(pt(66, a0 - 26 + (k / 10) * 26));
    s += line(trail, C.white, 3, 'opacity=".7"') + line(trail2, C.chrome, 2.5, 'opacity=".6"');
    s += shape([...out, ...inn.reverse()], C.chrome, C.chromeD, { sw: 2.5, dx: 1.5, dy: 1.5 }) + flat(out.slice(3, 12).map(([x, y], j) => [x - (x - 100) * 0.04, y - (y - 100) * 0.04]).concat(inn.slice(3, 12).reverse()), C.white, 'opacity=".8"');
  }
  return s;
});

add('fx_crit', () => {
  const sb = (ro, ri, k, yk) => star(36, 24, ro, ri, k, -90).map(([x, y]) => [x, 24 + (y - 24) * yk]);
  let s = shape(sb(33, 26, 14, 0.62), C.coral, C.coralD, { sw: 2.2, dx: 2, dy: 2 }) + shape(sb(25, 20, 14, 0.6), C.cream, C.creamD, { sw: 1.6, dx: 1.5, dy: 1.5, stroke: C.coralD });
  s += `<circle cx="27" cy="17.5" r="4" fill="none" stroke="${C.coral}" stroke-width="3.2"/><circle cx="45" cy="30.5" r="4" fill="none" stroke="${C.coral}" stroke-width="3.2"/>` + line([[46, 14], [26, 34]], C.plum, 5.4) + line([[46, 14], [26, 34]], C.coral, 3);
  return rot(s, -8, 36, 24);
});

add('tier_star', () => shape(star(12, 12.8, 10, 4.4, 5), C.gold, C.goldD, { sw: 2, dx: 1.5, dy: 1.5 }) + flat([[8, 9], [11, 4.5], [11.5, 9.5]], '#FFE08A', 'opacity=".9"'));

// ---------- legendary icons ----------
const spk = (x, y, r) => shape(star(x, y, r, r * 0.3, 4, -90), C.gold, null, { sw: 1.6 }) + flat(star(x, y, r * 0.5, r * 0.15, 4, -90), C.white);
const GL = '#FFE08A';

add('icon_powerstrip', () => {
  const x = 20, y = 98, w = 130, h = 40, dx = 26, dy = 16;
  let s = prism(x, y, w, h, dx, dy, [C.cream, C.creamD], [C.white, C.cream], [C.creamD, C.lav], { sw: SWi, sdx: 6, sdy: 4 });
  s += flat([[x + 4, y + 3], [x + w - 4, y + 3], [x + w - 6, y + 6], [x + 6, y + 6]], GL, 'opacity=".9"');
  const sx = [34, 64, 94, 124];
  sx.forEach((px, i) => {
    s += shape(rect(px, y + 10, 22, 24), C.coral, C.coralD, { sw: 3.5, dx: 3, dy: 3 });
    if (i !== 0 && i !== 2) s += rect(px + 5, y + 16, 4, 10).length && flat(rect(px + 5, y + 16, 4, 10), C.plum) + flat(rect(px + 13, y + 16, 4, 10), C.plum);
  });
  s += curve(`M${x + 11 + 34 - 20 + 8} ${y + 40} C30 156 70 176 70 150`, 5, C.teal, 4);
  s += curve(`M${x + 11 + 94 - 20 + 8} ${y + 40} C100 160 150 178 168 138`, 5, C.lav, 4);
  for (const [px, col, sh] of [[34, C.teal, C.tealD], [94, C.lavL, C.lav]]) s += prism(px + 1, y + 10, 20, 22, 6, 5, [col, sh], [C.white, col], [sh, C.plum], { sw: 3.5, sdx: 3, sdy: 3 });
  s += shape(rect(x + 2, y - 26, 0.1, 0.1), C.gold, null, { sw: 0 }).slice(0, 0);
  s += shape(rect(x + 8, y - 4, 14, 8), C.gold, C.goldD, { sw: 3, dx: 0, dy: 2.5 });
  s += `<circle cx="${x + 15}" cy="${y - 12}" r="5" fill="${GL}" stroke="${C.plum}" stroke-width="3"/><circle cx="${x + 14}" cy="${y - 13}" r="1.8" fill="${C.white}"/>`;
  s += line([[x + 15, y - 22], [x + 15, y - 28]], C.gold, 3) + line([[x + 4, y - 18], [x - 1, y - 22]], C.gold, 3) + line([[x + 26, y - 18], [x + 31, y - 22]], C.gold, 3);
  s += spk(160, 52, 10) + spk(176, 78, 6) + spk(118, 34, 5);
  return icon(s, 168);
});

add('icon_goldstar', () => {
  const cx = 94, cy = 92, ro = 78, ri = 38, P5 = star(cx, cy, ro, ri, 5);
  // tip index 4 (angle 54 deg => lower right) is the peeled corner; points alternate tip, inner
  const k = 5, a = P5[k - 1 + 0], tip = P5[k], b = P5[k + 1];
  const ux = b[0] - a[0], uy = b[1] - a[1], L2 = ux * ux + uy * uy, t = ((tip[0] - a[0]) * ux + (tip[1] - a[1]) * uy) / L2;
  const fx = a[0] + ux * t, fy = a[1] + uy * t, refl = [2 * fx - tip[0], 2 * fy - tip[1]];
  const body = P5.slice(); body.splice(k, 1);
  let s = S5(body, C.gold, C.goldD, { dx: 7, dy: 7 });
  s += shape(scalePts(body, 0.66, cx, cy + 4), C.gold, null, { sw: 3, stroke: C.goldD }).replace(`fill="${C.gold}"`, 'fill="none"');
  s += flat([[cx - 50, cy - 22], [cx - 4, cy - 64], [cx - 2, cy - 54], [cx - 44, cy - 14]], C.white, 'opacity=".9"') + flat([[cx - 58, cy - 12], [cx - 54, cy - 18], [cx - 52, cy - 10]], C.white);
  s += flat([[cx - 20, cy - 8], [cx + 10, cy - 12], [cx + 4, cy - 2]], GL, 'opacity=".8"');
  s += shape([a, b, refl], C.cream, C.creamD, { sw: SWi - 1, dx: -3, dy: -3 });
  s += flat([a, [a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5], [refl[0] * 0.5 + a[0] * 0.5, refl[1] * 0.5 + a[1] * 0.5]], C.lavL, 'opacity=".5"');
  s += spk(164, 40, 11) + spk(24, 140, 7) + spk(40, 30, 5);
  return icon(s, 176);
});

add('icon_laser', () => {
  const x = 30, y = 74, w = 96, h = 66, dx = 30, dy = 20;
  let s = shape([[x + 20, y + h], [x + w - 20, y + h], [x + w - 10, y + h + 14], [x + 10, y + h + 14]], C.plumSoft, C.plum, { sw: 4, dx: 0, dy: 4 });
  s += prism(x, y, w, h, dx, dy, [C.teal, C.tealD], [C.plumSoft, C.plum], [C.tealD, '#1D6A60'], { sw: SWi, sdx: 7, sdy: 5 });
  s += flat([[x + 4, y - 0], [x + dx + 6, y - dy + 2], [x + dx + 30, y - dy + 2], [x + 30, y + 0]], GL, 'opacity=".55"');
  s += shape(rect(x + 10, y + 16, 74, 22), '#1E1028', null, { sw: 3.5 }) + flat(rect(x + 14, y + 25, 66, 5), C.coral);
  const bar = [[0, 3], [5, 2], [9, 5], [16, 2], [21, 3], [26, 5]];
  bar.forEach(([o, bw], i) => { s += flat(rect(x + w + 5 + o * 0.7, y + 4 + 0, bw * 0.6, 34), C.cream).replace('<path', '<path opacity="0.95"'); });
  s += shape(rect(x + 10, y + 46, 18, 10), C.gold, C.goldD, { sw: 3, dx: 0, dy: 2.5 }) + `<circle cx="${x + 66}" cy="${y + 52}" r="5" fill="${C.coral}" stroke="${C.plum}" stroke-width="3"/>`;
  s += `<rect x="${x + 84}" y="${y + 17}" width="${186 - x - 84}" height="22" fill="${C.gold}" opacity=".28"/><rect x="${x + 84}" y="${y + 21}" width="${186 - x - 84}" height="14" fill="${C.gold}" opacity=".4"/>`;
  s += `<rect x="${x + 84}" y="${y + 24}" width="${186 - x - 84}" height="8" fill="${C.coral}" stroke="${C.plum}" stroke-width="0"/>`;
  s += spk(168, 50, 8) + spk(176, 112, 6) + spk(126, 30, 5);
  return icon(s, 170);
});

add('icon_snackbag', () => {
  let s = S5([[30, 64], [138, 64], [152, 100], [146, 150], [138, 166], [32, 166], [24, 150], [18, 100]], C.coral, C.coralD, { dx: 9, dy: 5 });
  s += S5([[26, 32], [142, 32], [138, 68], [30, 68]], C.gold, C.goldD, { dx: 5, dy: 5 });
  for (let i = 0; i < 12; i++) s += line([[34 + i * 9.2, 36], [34 + i * 8.9, 64]], C.goldD, 2.6, 'opacity=".9"');
  s += flat([[32, 36], [140, 35], [140, 39], [32, 40]], GL, 'opacity=".9"');
  s += shape(star(84, 112, 40, 31, 14), C.gold, C.goldD, { sw: 3.5, dx: 3, dy: 3 }) + shape([[64, 108], [86, 90], [104, 112], [96, 134], [74, 134]], C.breadL, C.bread, { sw: 3.5, dx: 3, dy: 3 }) + flat([[70, 108], [84, 97], [86, 104]], C.cream, 'opacity=".9"');
  s += flat([[34, 70], [44, 70], [38, 150], [32, 140]], C.coralL, 'opacity=".7"');
  for (const [px, py, r] of [[150, 160, 0], [166, 146, 25], [158, 172, -15]]) s += `<g transform="translate(${px} ${py}) rotate(${r})">` + shape([[-12, -8], [10, -12], [14, 6], [-6, 11]], C.gold, C.goldD, { sw: 3.5, dx: 2, dy: 2 }) + flat([[-8, -6], [4, -8], [-6, 0]], GL) + `</g>`;
  s += spk(166, 60, 9) + spk(180, 92, 5) + spk(12, 70, 5);
  return icon(s, 176);
});

add('fx_laser', () => {
  let s = '';
  const N = 16, sw = 256 / N, r = rng(12);
  for (let i = 0; i < N; i++) {
    const f = Math.max(0, 1 - Math.pow(i / N, 2.2) * 0.95), x = i * sw;
    s += `<rect x="${x}" y="6" width="${sw + 0.5}" height="28" fill="${C.gold}" opacity="${n(0.16 * f)}"/><rect x="${x}" y="11" width="${sw + 0.5}" height="18" fill="${C.gold}" opacity="${n(0.28 * f)}"/>`;
    s += `<rect x="${x}" y="16.5" width="${sw + 0.5}" height="7" fill="${C.coral}" opacity="${n(f)}"/><rect x="${x}" y="19" width="${sw + 0.5}" height="2" fill="${C.cream}" opacity="${n(f)}"/>`;
  }
  for (let x = 6; x < 250; x += 4 + Math.floor(r() * 9)) {
    const f = Math.max(0, 1 - Math.pow(x / 256, 2.2) * 0.95), hh = 12 + Math.floor(r() * 4) * 4, w = 1 + Math.floor(r() * 3);
    s += `<rect x="${x}" y="${20 - hh / 2}" width="${w}" height="${hh}" fill="${C.coralD}" opacity="${n(0.85 * f)}"/>`;
  }
  return s;
});

add('loyalty_card', () => {
  let s = shape([[4, 11], [9, 4], [87, 4], [92, 11], [92, 53], [87, 60], [9, 60], [4, 53]], C.plum, '#1E1028', { sw: 2, dx: 3, dy: 3, stroke: C.plumSoft });
  s += shape([[5, 38], [91, 30], [91, 42], [5, 50]], C.gold, C.goldD, { sw: 2, dx: 0, dy: 2.5 });
  s += flat([[8, 40], [88, 32.5], [88, 34], [8, 42]], GL, 'opacity=".8"');
  s += shape([[12, 22], [20, 13], [28, 22]].map(([a, b]) => [a - 4, b - 1]), C.green, null, { sw: 1.5 }).replace(/<path/, '<path');
  s += shape([[44, 22], [36, 13], [28, 22]].map(([a, b]) => [a + 4, b - 1]), C.green, null, { sw: 1.5 });
  s += shape(ellPath(28, 24, 9, 8), C.green, C.greenD, { sw: 1.8, dx: 1.5, dy: 1.5 }) + `<circle cx="25" cy="23" r="1.4" fill="${C.plum}"/><circle cx="31" cy="23" r="1.4" fill="${C.plum}"/>` + line([[24, 27.5], [28, 29], [32, 27.5]], C.plum, 1.4);
  s += shape(star(72, 20, 10, 4.4, 5), C.coral, C.coralD, { sw: 1.8, dx: 1.5, dy: 1.5 });
  for (let i = 0; i < 10; i++) s += flat(rect(14 + i * 5.2, 50.5, 1.6 + (i % 3) * 0.8, 7), C.cream, 'opacity=".85"');
  return s;
});

// =====================================================================================
// DEPARTMENTS
// =====================================================================================
const checkerFloor = (a, b, grout, extra = '', gw = 2, go = 0.55) =>
  `<rect width="128" height="128" fill="${a}"/><rect x="64" y="0" width="64" height="64" fill="${b}"/><rect x="0" y="64" width="64" height="64" fill="${b}"/>` +
  `<path d="M64 0V128M0 64H128M0 0V128M0 0H128" stroke="${grout}" stroke-width="${gw}" opacity="${go}" fill="none"/>` + extra;
const speck = (x, y, r, col, o = 0.7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" opacity="${o}"/>`;
add('floor_frozen', () => checkerFloor('#CDE9F1', '#DDF2F4', '#A5D0DE', `<rect x="0" y="28" width="128" height="9" fill="#fff" opacity=".2"/><rect x="0" y="31" width="128" height="2.5" fill="#fff" opacity=".25"/>` +
  [[20, 14, 1.2], [44, 50, 1], [100, 20, 1.3], [84, 88, 1], [30, 104, 1.2], [112, 112, 1], [58, 78, 0.9], [8, 76, 1]].map(([x, y, r]) => speck(x, y, r, '#fff', 0.9)).join('') +
  line([[88, 40], [93, 44]], '#fff', 1.4, 'opacity=".7"') + line([[24, 90], [29, 87]], '#fff', 1.4, 'opacity=".7"')));
add('floor_bakery', () => checkerFloor('#E6BEA4', '#F2E3CA', '#D3A78C', [[26, 20, 1.6], [90, 36, 1.2], [40, 96, 1.4], [108, 100, 1.1], [72, 70, 1]].map(([x, y, r]) => speck(x, y, r, '#fff', 0.8)).join('') + line([[96, 84], [104, 86]], '#fff', 2, 'opacity=".5"') + line([[14, 44], [20, 42]], '#C79275', 1.4, 'opacity=".6"')));
add('floor_electronics', () => checkerFloor('#4E6B78', '#5B7C88', '#3F5864', line([[18, 24], [30, 22]], '#6F93A0', 1.5, 'opacity=".6"') + line([[96, 100], [108, 102]], '#6F93A0', 1.5, 'opacity=".6"') + speck(100, 26, 1.4, '#7BA3B0', 0.7) + speck(30, 98, 1.4, '#7BA3B0', 0.7) + `<path d="M32 0V128M96 0V128M0 32H128M0 96H128" stroke="#3F5864" stroke-width="1" opacity=".5" fill="none"/>`, 2.5, 0.8));
add('floor_checkout', () => `<rect width="128" height="128" fill="${C.cream}"/><rect x="64" y="0" width="64" height="64" fill="#FBE9C6"/><rect x="0" y="64" width="64" height="64" fill="#FBE9C6"/>` +
  `<rect x="0" y="0" width="4" height="128" fill="${C.coral}" opacity=".2"/><rect x="124" y="0" width="4" height="128" fill="${C.coral}" opacity=".2"/><rect x="62" y="0" width="4" height="128" fill="${C.coral}" opacity=".12"/>` +
  `<path d="M0 64H128M0 0H128" stroke="${C.creamD}" stroke-width="2" opacity=".8" fill="none"/>` + line([[20, 40], [28, 38]], C.creamD, 1.5, 'opacity=".8"') + line([[96, 100], [106, 102]], C.creamD, 1.5, 'opacity=".8"'));

// bakery goods
const bgt = (x, y, L, deg) => `<g transform="translate(${x} ${y}) rotate(${deg})">` + shape([[-L / 2, -4], [L / 2 - 4, -5], [L / 2 + 1, 0], [L / 2 - 4, 5], [-L / 2, 4], [-L / 2 - 2, 0]], C.bread, C.breadD, { sw: SWs, dx: 0, dy: 2 }) + [-0.25, 0, 0.25].map((k) => line([[k * L - 2, -3], [k * L + 2, 3]], C.cream, 1.6)).join('') + `</g>`;
const loaf = (x, y, r) => ell(x, y, r, r * 0.8, C.bread, C.breadD, { sw: SWs, dx: 2, dy: 2 }) + [-0.4, 0, 0.4].map((k) => line([[x + k * r - 2, y - r * 0.4], [x + k * r + 2, y + r * 0.2]], C.cream, 1.6)).join('');
const croissant = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">` + shape('M-13 5 Q-12 -8 0 -9 Q12 -8 13 5 L8 4 Q5 -3 0 -3 Q-5 -3 -8 4Z', C.breadL, C.bread, { sw: SWs, dx: 1, dy: 2 }) + line([[-5, -3], [-8, 4]], C.breadD, 1.4) + line([[5, -3], [8, 4]], C.breadD, 1.4) + line([[0, -4], [0, 1]], C.breadD, 1.4) + `</g>`;
const tart = (x, y, r, col = C.coral) => ell(x, y, r, r * 0.7, C.cream, C.creamD, { sw: SWs, dx: 1.5, dy: 1.5 }) + `<circle cx="${x}" cy="${y - 1}" r="${r * 0.35}" fill="${col}" stroke="${C.plum}" stroke-width="1.5"/>`;
function woodRack(kind) {
  const W = C.breadD, WL = C.bread, boards = kind === 'a' ? [50, 90, 128] : [54, 92, 128];
  let s = shape(rect(2, 4, 252, 142), '#8A5A33', null, { sw: SW });
  s += flat(rect(14, 18, 228, 114), '#A06A3A');
  boards.forEach((b, i) => {
    s += flat(rect(14, b - 28, 228, 28), '#B07A45', 'opacity=".35"');
    if (kind === 'a') {
      if (i === 0) for (let x = 30; x < 230; x += 40) s += bgt(x, b - 12, 54, -8 + (x % 3) * 6) + bgt(x + 12, b - 9, 54, 6);
      if (i === 1) for (let x = 36; x < 230; x += 34) s += loaf(x, b - 11, 15);
      if (i === 2) for (let x = 36; x < 230; x += 40) s += croissant(x, b - 8, 1.25) + tart(x + 20, b - 6, 8);
    } else {
      if (i === 0) for (let x = 34; x < 230; x += 32) s += tart(x, b - 9, 11, [C.coral, C.gold, C.teal][(x / 32) | 0 % 3]) ;
      if (i === 1) for (let x = 36; x < 230; x += 46) s += croissant(x, b - 9, 1.4) + loaf(x + 22, b - 10, 11);
      if (i === 2) for (let x = 28; x < 230; x += 22) s += bgt(x, b - 22, 56, 72 + (x % 3) * 4) ;
    }
    s += shape(rect(10, b, 236, 9), WL, W, { sw: SWs + 0.5, dx: 0, dy: 3 });
    s += flat(rect(18, b + 2, 56, 5), C.cream, 'opacity=".9"') + flat(rect(80, b + 2, 14, 5), C.coral);
  });
  s += shape(rect(2, 4, 12, 142), WL, W, { sw: SW, dx: 3, dy: 0 }) + shape(rect(242, 4, 12, 142), WL, W, { sw: SW, dx: 3, dy: 0 });
  if (kind === 'a') s += shape(rect(2, 4, 252, 14), WL, W, { sw: SW, dx: 0, dy: 4 }) + [0, 1, 2, 3, 4, 5].map((i) => flat(rect(20 + i * 40, 8, 22, 5), C.cream)).join('');
  else {
    const pts = [[2, 4], [254, 4], [254, 24]]; for (let i = 0; i < 12; i++) pts.push([254 - i * 21 - 10.5, 30], [254 - (i + 1) * 21, 24]);
    s += shape(pts, C.coral, C.coralD, { sw: SW, dx: 0, dy: 4 });
    for (let i = 1; i < 12; i += 2) s += flat([[254 - i * 21, 8], [254 - (i + 1) * 21, 8], [254 - (i + 1) * 21, 24], [254 - i * 21, 24]], C.cream, 'opacity=".95"');
  }
  s += shape(rect(2, 136, 252, 10), W, '#7A4A1F', { sw: SW, dx: 0, dy: 3 });
  return s;
}
add('bakery_rack_a', () => inset(256, 150, woodRack('a')));
add('bakery_rack_b', () => inset(256, 150, woodRack('b')));

add('oven_wall', () => {
  let s = shape(rect(2, 4, 252, 142), C.chromeD, '#7C8599', { sw: SW, dx: 0, dy: 0 });
  s += shape(rect(2, 4, 252, 22), C.chrome, C.chromeD, { sw: SW, dx: 0, dy: 4 });
  for (let x = 14; x < 240; x += 24) s += shape(rect(x, 9, 16, 10), '#5A5270', null, { sw: 2 }) + line([[x + 3, 14], [x + 13, 14]], C.chromeD, 1.6);
  s += shape(rect(2, 136, 252, 10), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 3 });
  const door = (x, w, glow) => {
    let d = shape(rect(x, 32, w, 98), C.chrome, C.chromeD, { sw: SW, dx: 4, dy: 4 });
    d += shape(rect(x + 8, 42, w - 16, 62), '#241638', null, { sw: SW });
    if (glow) {
      d += flat(rect(x + 11, 45, w - 22, 56), '#E2602C') + flat(rect(x + 16, 52, w - 32, 44), '#F48A3A') + flat(rect(x + 24, 60, w - 48, 30), C.gold, 'opacity=".9"');
      for (let t = 0; t < 2; t++) d += flat(rect(x + 12, 68 + t * 18, w - 24, 3), C.chromeD);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) d += `<circle cx="${x + 26 + i * ((w - 52) / 4)}" cy="${77 + j * 18}" r="7" fill="${C.bread}" stroke="${C.plum}" stroke-width="2.5"/><circle cx="${x + 24 + i * ((w - 52) / 4)}" cy="${75 + j * 18}" r="2.4" fill="${C.breadL}"/>`;
    } else d += flat([[x + 12, 46], [x + 40, 46], [x + 14, 98]], '#F48A3A', 'opacity=".25"') + flat(rect(x + 11, 94, w - 22, 8), '#E2602C', 'opacity=".5"');
    d += shape(rect(x + 10, 110, w - 20, 7), C.chromeL, C.chromeD, { sw: 2.5, dx: 0, dy: 2 });
    d += `<circle cx="${x + 14}" cy="${122}" r="3.4" fill="${C.coral}" stroke="${C.plum}" stroke-width="2"/><circle cx="${x + w - 14}" cy="122" r="3.4" fill="${C.gold}" stroke="${C.plum}" stroke-width="2"/>`;
    return d;
  };
  s += door(8, 66, false) + door(86, 84, true) + door(182, 66, false);
  s += flat(rect(100, 30, 56, 2), C.gold, 'opacity=".6"');
  return inset(256, 150, s);
});

// TV wall
const screen = (x, y, w, h, th, content) => {
  const [a, b, c] = th;
  let s = flat(rect(x - 4, y - 4, w + 8, h + 8), b, 'opacity=".22"');
  s += shape(rect(x - 2, y - 2, w + 4, h + 4), C.plum, null, { sw: SW });
  const id = `c${++uid}`;
  s += `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">`;
  s += flat(rect(x, y, w, h), a) + flat(rect(x, y + h * 0.5, w, h * 0.5), b, 'opacity=".55"') + flat([[x, y], [x + w * 0.5, y], [x + w * 0.1, y + h]], c, 'opacity=".25"') + flat(rect(x, y + h * 0.78, w, h * 0.22), a, 'opacity=".6"');
  const cx = x + w / 2, cy = y + h / 2, k = Math.min(w, h) / 40;
  if (content === 'goblin') s += `<g transform="translate(${cx} ${cy + 2 * k}) scale(${k})">` + flat([[-18, -2], [-8, -12], [-14, -22]], C.plum) + flat([[18, -2], [8, -12], [14, -22]], C.plum) + flat(ellPath(0, 0, 13, 12), C.plum) + flat([[10, 2], [22, 8], [10, 8]], C.plum) + flat([[-8, -3], [-3, -5], [-3, -1]], c) + flat([[8, -3], [3, -5], [3, -1]], c) + `</g>`;
  if (content === 'cart') s += `<g transform="translate(${cx} ${cy}) scale(${k})">` + line([[-16, -12], [-10, -12], [-5, 8], [14, 8]], c, 3.4) + flat([[-9, -8], [16, -8], [12, 4], [-6, 4]], c, 'opacity=".9"') + `<circle cx="-2" cy="14" r="3.2" fill="${c}"/><circle cx="11" cy="14" r="3.2" fill="${c}"/></g>`;
  if (content === 'bars') for (let i = 0; i < 6; i++) s += flat(rect(x + 4 + i * (w / 6), y + h - 6 - (i * 7) % 18 - 6, w / 6 - 3, 12 + (i * 7) % 18), c, 'opacity=".9"');
  if (content === 'star') s += flat(star(cx, cy, 14 * k, 6 * k, 5), c);
  if (content === 'wave') s += line([[x + 4, cy], [x + w * 0.3, cy - 8 * k], [x + w * 0.6, cy + 8 * k], [x + w - 4, cy - 2 * k]], c, 3.5);
  s += flat([[x + 2, y + 2], [x + w * 0.4, y + 2], [x + 2, y + h * 0.4]], C.white, 'opacity=".12"') + `</g>`;
  return s;
};
const TH = { teal: ['#2F8F93', '#3FB7A6', '#CFF3FF'], coral: ['#C9443B', '#F45F52', '#FFD0C0'], sky: ['#4E7FC9', '#7CC4E8', '#E8F9FF'], plum: ['#4A3560', '#9081B6', '#F5BD45'], gold: ['#D08D20', '#F5BD45', '#FFF0A0'], green: ['#5E9A35', '#8FCB57', '#E8FFD0'] };
function tvWall(kind) {
  let s = shape(rect(2, 4, 252, 142), '#3A2B52', null, { sw: SW }) + shape(rect(2, 4, 252, 12), C.lav, C.lavD, { sw: SW, dx: 0, dy: 3 }) + shape(rect(2, 136, 252, 10), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 3 });
  s += flat(rect(12, 22, 232, 110), '#2A1E3E');
  if (kind === 'a') {
    const items = [['teal', 'goblin'], ['coral', 'cart'], ['sky', 'bars'], ['gold', 'star'], ['plum', 'wave'], ['green', 'goblin']];
    items.forEach(([t, c], i) => { s += screen(18 + (i % 3) * 76, 28 + Math.floor(i / 3) * 52, 68, 44, TH[t], c); });
  } else {
    s += screen(78, 28, 100, 96, TH.coral, 'goblin');
    [['teal', 'cart'], ['sky', 'wave'], ['gold', 'bars'], ['green', 'star']].forEach(([t, c], i) => { s += screen(i < 2 ? 18 : 190, 28 + (i % 2) * 52, 50, 44, TH[t], c); });
  }
  s += flat(rect(12, 128, 232, 4), '#9081B6', 'opacity=".5"');
  return inset(256, 150, s);
}
add('tv_wall_a', () => tvWall('a'));
add('tv_wall_b', () => tvWall('b'));

add('freezer_c', () => {
  let s = shape([[96, 6], [160, 6], [160, 26], [96, 26]], '#E8F9FF', '#A9DDF0', { sw: SW, dx: 3, dy: 3 }) + snowflake(128, 16, 7, C.sky, 2.4) + line([[104, 26], [104, 40]], C.chromeD, 2) + line([[152, 26], [152, 40]], C.chromeD, 2);
  s += shape([[22, 40], [234, 40], [246, 74], [10, 74]], '#E8F4FA', '#B9D6E6', { sw: SW, dx: 0, dy: 4 });
  s += shape([[32, 46], [224, 46], [232, 68], [24, 68]], '#8FC4DC', '#6FA9C4', { sw: SW, dx: 4, dy: 4 });
  const tub = (x, y, col, lid) => shape([[x, y + 4], [x + 22, y + 4], [x + 20, y + 22], [x + 2, y + 22]], col, SH[Object.keys(C).find((q) => C[q] === col)] ?? C.lavD, { sw: SWs, dx: 3, dy: 0 }) + shape(rect(x - 1, y, 24, 6), lid, null, { sw: SWs }) + flat(rect(x + 5, y + 10, 11, 6), C.cream, 'opacity=".85"');
  const bag = (x, y) => shape([[x, y + 4], [x + 6, y], [x + 22, y], [x + 28, y + 4], [x + 26, y + 24], [x + 2, y + 24]], C.green, C.greenD, { sw: SWs, dx: 3, dy: 3 }) + flat(rect(x + 5, y + 9, 16, 8), C.cream, 'opacity=".9"') + `<circle cx="${x + 13}" cy="${y + 13}" r="2.6" fill="${C.greenD}"/>`;
  [[40, 40, C.coral, C.cream], [64, 42, C.gold, C.coral], [88, 40, C.teal, C.cream], [150, 42, C.lavL, C.white], [174, 40, C.cream, C.coral], [196, 42, C.sky, C.cream]].forEach(([x, y, c, l]) => { s += tub(x, y, c, l); });
  s += bag(112, 40) + bag(122, 44);
  s += shape([[10, 74], [246, 74], [246, 138], [10, 138]], '#DCE8F2', '#B3C7D8', { sw: SW, dx: 4, dy: 4 });
  s += shape(rect(10, 74, 236, 10), C.lav, C.lavD, { sw: SW, dx: 0, dy: 3 });
  for (let x = 24; x < 220; x += 60) s += flat(rect(x, 96, 34, 8), C.coral) + flat(rect(x + 38, 96, 10, 8), C.cream);
  s += shape(rect(100, 112, 56, 8), C.chrome, C.chromeD, { sw: SWs + 0.5, dx: 0, dy: 3 }) + flat([[18, 88], [60, 88], [18, 128]], C.white, 'opacity=".5"');
  s += shape(rect(10, 138, 236, 8), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 3 });
  return inset(256, 150, s);
});

add('checkout_counter', () => {
  let s = '';
  // lane light pole
  s += shape(rect(232, 34, 7, 104), C.chrome, C.chromeD, { sw: SWs + 0.5, dx: 2, dy: 0 });
  s += flat(rect(218, 12, 36, 28), C.coral, 'opacity=".25"') + shape([[220, 36], [252, 36], [250, 14], [222, 14]], C.coral, C.coralD, { sw: SW, dx: 4, dy: 3 }) + flat([[225, 18], [236, 18], [226, 30]], C.cream, 'opacity=".9"') + shape(rect(216, 36, 40, 5), C.plumSoft, C.plum, { sw: 2, dx: 0, dy: 2 });
  // counter body
  s += prism(14, 88, 176, 50, 34, 22, [C.cream, C.creamD], ['#5B4D7A', C.plumSoft], [C.creamD, C.lav], { sw: SW, sdx: 6, sdy: 5 });
  for (let x = 24; x < 180; x += 24) s += flat([[x, 92], [x + 10, 92], [x + 2, 136], [x - 8, 136]], C.coral, 'opacity=".9"');
  s += shape(rect(14, 130, 176, 8), C.plumSoft, C.plum, { sw: SW, dx: 0, dy: 3 });
  // conveyor surface details
  for (let i = 0; i < 9; i++) s += line([[34 + i * 20, 87.5 - 0], [44 + i * 20, 67]], '#7A6AA0', 1.8, 'opacity=".8"');
  for (let i = 0; i < 4; i++) s += flat([[60 + i * 30, 80], [66 + i * 30, 80], [76 + i * 30, 74], [70 + i * 30, 74]], C.lavL, 'opacity=".6"');
  // register
  s += prism(150, 52, 40, 30, 14, 9, [C.teal, C.tealD], [C.plumSoft, C.plum], [C.tealD, '#1D6A60'], { sw: SWs + 0.5, sdx: 4, sdy: 3 });
  s += shape(rect(155, 58, 18, 11), '#241638', null, { sw: 2 }) + flat(rect(158, 61, 10, 2), C.gold) + shape(rect(155, 72, 28, 7), C.cream, C.creamD, { sw: 2, dx: 0, dy: 2 });
  // candy rack
  s += shape(rect(24, 44, 40, 4), C.plumSoft, null, { sw: 2 }) + line([[28, 44], [26, 88]], C.plum, 3) + line([[60, 44], [62, 88]], C.plum, 3);
  [[30, 62, C.gold], [42, 60, C.coral], [52, 62, C.teal], [32, 76, C.sky], [44, 76, C.lavL], [54, 74, C.coral]].forEach(([x, y, c]) => { s += shape(rect(x, y, 9, 11), c, null, { sw: 2 }); });
  s += shape(rect(22, 50, 44, 5), C.coral, C.coralD, { sw: 2.5, dx: 0, dy: 2 });
  return inset(256, 150, s);
});

// side units
const sideUnit = (seed, o, pal) => inset(96, 220, shelfUnit(96, 220, { seed, boards: [56, 96, 136, 176], up: 9, hdr: 22, kick: 14, pal, ...o }));
add('side_freezer', () => sideUnit(31, { fc: '#CFE8F4', fs: '#8FC4DC', bc: '#6FA9C4', bd: '#9FD0E6', boardc: '#E8F9FF', boards2: C.sky }, [C.coral, C.teal, C.gold, C.cream, C.lavL, C.sky]));
add('side_bakery', () => sideUnit(32, { fc: C.bread, fs: C.breadD, bc: '#8A5A33', bd: '#A06A3A', boardc: C.breadL }, [C.breadL, C.bread, C.cream, C.coral, C.gold]));
add('side_electronics', () => sideUnit(33, { fc: '#5B7C88', fs: '#3F5864', bc: '#2E3F4D', bd: '#3A5260', boardc: '#7FA3B0' }, [C.teal, C.sky, C.cream, C.coral, C.lavL, C.plumSoft]));
add('side_checkout', () => sideUnit(34, { fc: C.coral, fs: C.coralD, bc: '#8F2D2C', bd: '#A8383A', boardc: C.cream }, [C.gold, C.teal, C.cream, C.sky, C.lavL, C.green]));

// hazards

add('ob_can_bowl', () => nudge(0, -3, (() => {
  const pal = [[C.soda, C.sodaD], [C.blue, C.blueD], [C.gold, C.goldD], [C.teal, C.tealD]];
  let s = shadowE(60, 83, 52, 6, 0.25);
  const rows = [[11, [60]], [28, [47, 73]], [45, [34, 60, 86]], [62, [21, 47, 73, 99]]];
  let k = 0;
  for (const [top, xs] of rows) for (const x of xs) { const [a, b] = pal[k++ % 4]; s += can(x, top + 2, 25, 20, a, b, C.cream, { sw: SW - 0.5 }); }
  // bowling ball waiting at the front
  s += ell(104, 76, 13, 13, C.plum, C.plumSoft, { sw: SWs, dx: 2, dy: 2 }) + `<circle cx="100" cy="72" r="2" fill="${C.lavL}"/><circle cx="106" cy="71" r="2" fill="${C.lavL}"/><circle cx="103" cy="77" r="2" fill="${C.lavL}"/>`;
  return s;
})()));
add('ob_candy_display', () => {
  let s = shadowE(55, 98, 50, 7, 0.25);
  s += shape([[8, 88], [88, 88], [94, 98], [4, 98]], C.lavD, C.plumSoft, { sw: SW, dx: 0, dy: 3 });
  s += prism(12, 52, 80, 36, 8, 6, [C.coral, C.coralD], [C.cream, C.creamD], [C.coralD, '#8F2D27'], { sw: SWs + 0.5, sdx: 3, sdy: 3 });
  const pal = [['#F7A6B8', '#D9748B'], [C.gold, C.goldD], [C.teal, C.tealD], [C.green, C.greenD]];
  pal.forEach(([a, b], i) => { s += ell(22 + i * 20, 48, 10, 11, a, b, { sw: SWs, dx: 1.5, dy: 1.5 }) + flat(rect(17 + i * 20, 36, 10, 4), C.cream, 'opacity=".8"'); });
  for (const [x, y, c] of [[30, 8, C.coral], [54, 4, C.sky], [76, 10, C.gold]]) s += tube([[x, y + 10], [x, 40]], 3, C.cream, 2) + ell(x, y, 9, 9, c, null, { sw: SWs }) + `<path d="M${x - 5} ${y} Q${x} ${y - 6} ${x + 5} ${y}" stroke="${C.cream}" stroke-width="2" fill="none"/>`;
  s += S5(rect(30, 66, 44, 14), C.gold, C.goldD, { sw: 3 }) + shape(star(52, 73, 6, 3, 5), C.coral, null, { sw: 1.2 });
  return s;
});
add('ob_spring_mat', () => {
  let s = shadowE(80, 44, 70, 7, 0.22);
  s += shape([[10, 26], [150, 26], [158, 46], [2, 46]], C.plum, C.plumSoft, { sw: SW, dx: 0, dy: 4 });
  s += shape([[18, 28], [142, 28], [148, 40], [12, 40]], C.gold, C.goldD, { sw: SWs, dx: 0, dy: 2 });
  for (const x of [46, 80, 114]) s += shape([[x - 12, 38], [x, 28], [x + 12, 38], [x + 5, 38], [x, 33], [x - 5, 38]], C.coral, null, { sw: 2 });
  s += line([[22, 30], [138, 30]], C.cream, 2, 'opacity=".6"');
  return s;
});
add('hz_ice', () => {
  const pd = smooth(puddlePts(110, 60, 102, 52, 5)), pd2 = smooth(puddlePts(110, 58, 78, 38, 9));
  let s = `<path d="${pd}" fill="#CFF3FF" fill-opacity=".75" stroke="#6FB7D8" stroke-width="3" stroke-opacity=".8"/><path d="${pd2}" fill="#E8F9FF" fill-opacity=".6"/>`;
  s += [[[40, 62], [78, 30]], [[52, 76], [100, 34]], [[130, 88], [172, 52]]].map(([a, b], i) => line([a, b], C.white, 6 - i, 'opacity=".9"')).join('');
  s += line([[150, 80], [176, 60]], C.white, 3, 'opacity=".8"') + flat([[168, 90], [176, 86], [172, 96]], C.white, 'opacity=".7"');
  return s;
});
const ventBase = (hot) => {
  const id = `c${++uid}`;
  let s = shape(ellPath(65, hot ? 52 : 44, 60, 25, 0), '#000', null) .slice(0, 0);
  const cy = hot ? 42 : 40;
  s += ell(65, cy + 6, 60, 24, hot ? C.coralD : C.chromeD, null, { sw: 3.5 });
  s += ell(65, cy, 60, 24, C.cream, C.creamD, { sw: 3.5, dx: 4, dy: 4 });
  s += ell(65, cy, 50, 18, hot ? '#F5A33A' : C.chromeD, hot ? '#E2602C' : '#7C8599', { sw: 3, dx: 3, dy: 3 });
  s += `<clipPath id="${id}"><path d="${ellPath(65, cy, 48, 16)}"/></clipPath><g clip-path="url(#${id})">`;
  for (let y = cy - 13; y < cy + 14; y += 7) s += shape(rect(10, y, 110, 4.6), hot ? '#FFE08A' : '#241638', null, { sw: 1.4, stroke: C.plum });
  s += `</g>`;
  s += flat([[22, cy - 8], [50, cy - 20], [58, cy - 18], [28, cy - 4]], C.white, `opacity="${hot ? 0.5 : 0.35}"`);
  return s;
};
add('hz_vent', () => ventBase(false));
add('hz_vent_hot', () => {
  let s = `<ellipse cx="65" cy="45" rx="62" ry="27" fill="${C.gold}" opacity=".2"/>` + ventBase(true);
  for (const x of [34, 60, 86]) s += `<path d="M${x} 24 Q${x + 6} 18 ${x} 12 Q${x - 6} 8 ${x} 4.5" fill="none" stroke="${C.gold}" stroke-width="3.4" stroke-linecap="round" opacity=".85"/><path d="M${x + 12} 20 Q${x + 18} 14 ${x + 12} 8" fill="none" stroke="${C.coral}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>`;
  return s;
});
add('hz_cable', () => {
  const pts = []; for (let x = -8; x <= 264; x += 4) pts.push([x, 18 + 8.5 * Math.sin((x / 128) * Math.PI * 2)]);
  const slope = (x) => Math.atan(8.5 * Math.cos((x / 128) * Math.PI * 2) * ((Math.PI * 2) / 128)) * 180 / Math.PI;
  let s = line(pts, '#14091C', 15) + line(pts, C.plumSoft, 10.5) + line(pts.map(([x, y]) => [x - 1, y - 2.6]), C.lav, 2.2, 'opacity=".75"');
  for (const x of [46, 100, 182, 222]) {
    const y = 18 + 8.5 * Math.sin((x / 128) * Math.PI * 2);
    s += `<g transform="translate(${x} ${y}) rotate(${n(slope(x) + 90)})">` + shape(rect(-9, -6, 18, 12), x === 100 || x === 222 ? C.gold : C.cream, null, { sw: 2 }) + line([[-5, -4], [-5, 4]], C.goldD, 1.2, 'opacity=".5"') + `</g>`;
  }
  return s;
});
add('hz_conveyor', () => {
  let s = `<rect x="0" y="9" width="128" height="46" fill="#3A2F4D"/><rect x="0" y="9" width="128" height="9" fill="#2A1E38"/>`;
  for (let x = 0; x <= 128; x += 32) s += `<rect x="${x - 1}" y="9" width="2" height="46" fill="#241638" opacity=".8"/>`;
  for (const x of [6, 38, 70, 102]) s += flat([[x, 20], [x + 8, 20], [x + 21, 32], [x + 8, 44], [x, 44], [x + 13, 32]], C.lav, 'opacity=".9"') + flat([[x + 1, 21], [x + 6, 21], [x + 17, 31], [x + 13, 31]], C.lavL, 'opacity=".7"');
  s += `<rect x="0" y="0" width="128" height="9" fill="${C.chrome}"/><rect x="0" y="55" width="128" height="9" fill="${C.chromeD}"/><rect x="0" y="0" width="128" height="3" fill="${C.chromeL}"/><rect x="0" y="9" width="128" height="3" fill="${C.plum}"/><rect x="0" y="52" width="128" height="3" fill="${C.plum}"/><rect x="0" y="0" width="128" height="1.5" fill="${C.plum}"/><rect x="0" y="62.5" width="128" height="1.5" fill="${C.plum}"/>`;
  for (let x = 16; x < 128; x += 32) s += `<circle cx="${x}" cy="5" r="1.8" fill="${C.chromeD}"/><circle cx="${x}" cy="59.5" r="1.8" fill="${C.plumSoft}"/>`;
  return s;
});

// props
add('prop_icecream', () => {
  let s = shadowE(55, 93, 44, 6, 0.25);
  s += shape([[30, 20], [80, 20], [96, 38], [14, 38]], C.coral, C.coralD, { sw: SW, dx: 0, dy: 4 });
  for (const x of [30, 52, 74]) s += flat([[x, 21], [x + 12, 21], [x + 5, 37], [x - 7, 37]], C.cream);
  s += line([[55, 38], [55, 56]], C.plum, 5) + line([[55, 38], [55, 56]], C.chrome, 2);
  s += prism(22, 52, 56, 30, 18, 10, [C.teal, C.tealD], [C.cream, C.creamD], [C.tealD, '#1D6A60'], { sw: SW, sdx: 5, sdy: 4 });
  s += shape([[44, 58], [56, 58], [50, 76]], '#E8B25A', C.breadD, { sw: 2, dx: 1.5, dy: 1 }) + `<circle cx="50" cy="56" r="6" fill="${C.coralL}" stroke="${C.plum}" stroke-width="2.5"/><circle cx="47.5" cy="54" r="1.8" fill="${C.white}"/>`;
  s += tube([[22, 56], [11, 47]], 3, C.chromeD, 2) + shape(rect(3, 42, 12, 6), C.coral, C.coralD, { sw: 2, dx: 0, dy: 2 });
  for (const x of [34, 82]) s += `<circle cx="${x}" cy="86" r="7.5" fill="${C.plumSoft}" stroke="${C.plum}" stroke-width="3"/><circle cx="${x}" cy="86" r="2.8" fill="${C.lavL}"/>`;
  return s;
});
add('prop_breadbasket', () => {
  let s = shadowE(55, 83, 44, 6, 0.25);
  s += bgt(36, 36, 56, -62) + bgt(66, 34, 56, -76) + loaf(50, 40, 18) + croissant(78, 44, 1.3);
  s += shape([[14, 46], [96, 46], [86, 82], [24, 82]], '#C98E4B', '#A56E31', { sw: SW, dx: 6, dy: 4 });
  for (let y = 54; y < 80; y += 8) s += line([[18 + (y - 46) * 0.3, y], [93 - (y - 46) * 0.3, y]], '#8A5A33', 2, 'opacity=".8"');
  for (let x = 24; x < 90; x += 10) s += line([[x, 49], [x - 2 + ((x / 10) | 0) % 2 * 4, 80]], '#E3B070', 1.8, 'opacity=".8"');
  s += shape([[10, 42], [100, 42], [98, 50], [12, 50]], C.breadL, C.bread, { sw: SW, dx: 0, dy: 3 });
  return s;
});
add('prop_tvbox', () => nudge(-12, -3, (() => {
  let s = shadowE(60, 94, 44, 6, 0.25);
  const box = (x, y, w, h, c, sh, deg) => rot(prism(x, y, w, h, 14, 9, [C.cream, C.creamD], [c, sh], [C.creamD, C.lav], { sw: SW, sdx: 4, sdy: 3 }) + shape(rect(x + 5, y + 6, w - 10, h - 18), '#241638', null, { sw: 2 }) + flat([[x + 7, y + 8], [x + w * 0.5, y + 8], [x + 7, y + h * 0.5]], C.teal, 'opacity=".5"') + flat(rect(x + 5, y + h - 9, w - 10, 4), C.coral), deg, x + w / 2, y + h);
  s += box(14, 52, 62, 40, '#FFFDF7', C.creamD, 0) + box(66, 62, 34, 30, '#FFFDF7', C.creamD, 3);
  s += box(24, 18, 46, 34, C.lavL, C.lav, -4);
  return s;
})()));
add('prop_lanesign', () => {
  let s = shadowE(35, 113, 24, 5, 0.25);
  s += shape([[18, 108], [52, 108], [56, 115], [14, 115]], C.plumSoft, C.plum, { sw: SWs + 0.5, dx: 0, dy: 3 });
  s += shape(rect(31, 44, 7, 66), C.chrome, C.chromeD, { sw: SWs + 0.5, dx: 2, dy: 0 });
  s += flat(rect(8, 4, 54, 34), C.coral, 'opacity=".22"') + shape([[16, 32], [54, 32], [51, 8], [19, 8]], C.coral, C.coralD, { sw: SW, dx: 4, dy: 3 }) + flat([[22, 12], [34, 12], [23, 26]], C.cream, 'opacity=".9"');
  s += shape(rect(12, 32, 46, 6), C.plumSoft, C.plum, { sw: 2.5, dx: 0, dy: 2 });
  s += shape(rect(14, 52, 42, 30), C.cream, C.creamD, { sw: SW, dx: 3, dy: 3 });
  for (let i = 0; i < 4; i++) s += flat([[18 + i * 10, 55], [24 + i * 10, 55], [18 + i * 10 - 6 + 4, 79], [12 + i * 10 + 4, 79]].map(([x, y]) => [Math.min(53, Math.max(17, x)), y]), C.coral, 'opacity=".9"');
  return s;
});
add('bread_crumb', () => {
  let s = shadowE(16, 25, 12, 2.5, 0.25);
  s += shape([[3, 20], [2, 11], [8, 5], [20, 4], [27, 9], [28, 18], [23, 23], [8, 23]], C.bread, C.breadD, { sw: 2, dx: 2, dy: 2 });
  s += flat([[7, 12], [12, 8], [20, 7], [12, 13]], '#F7D690') + flat([[8, 17], [20, 14], [18, 19]], C.breadL, 'opacity=".6"');
  s += shape(rect(22, 2, 3, 9), C.green, null, { sw: 1.4 }) + shape(rect(19, 5, 9, 3), C.green, null, { sw: 1.4 }) + flat(rect(22.5, 2.5, 2, 8), C.green) + flat(rect(19.5, 5.5, 8, 2), C.green);
  return s;
});

// ---------- obstacles (ground footprint sits at the bottom; see OBSTACLE_KINDS in src/data/obstacles.ts) ----------
add('ob_gondola', () => {
  let s = shadowE(85, 98, 78, 7, 0.25);
  const cols = [[C.coral, C.coralD], [C.gold, C.goldD], [C.teal, C.tealD], [C.sky, '#5AA6CE'], [C.cream, C.creamD]];
  s += prism(10, 54, 140, 42, 16, 10, [C.lav, C.lavD], [C.lavL, C.lav], [C.lavD, '#4A3A73'], { sw: SW, sdx: 5, sdy: 4 });
  for (let i = 0; i < 6; i++) { const [f, d] = cols[i % 5]; s += shape(rect(18 + i * 21, 62, 17, 24), f, d, { sw: SWs, dx: 3, dy: 0 }) + flat(rect(21 + i * 21, 68, 11, 5), C.cream, 'opacity=".85"'); }
  s += shape(rect(10, 90, 140, 6), C.plumSoft, C.plum, { sw: SWs, dx: 0, dy: 2 });
  for (let i = 0; i < 4; i++) { const [f, d] = cols[(i + 1) % 5]; s += can(32 + i * 24, 34, 18, 18, f, d, C.cream); }
  s += shape(rect(104, 28, 22, 22), C.coral, C.coralD, { sw: SWs, dx: 3, dy: 3 }) + shape(star(115, 39, 7, 3.4, 5), C.gold, null, { sw: 1.5 });
  return s;
});
add('ob_display', () => {
  let s = shadowE(55, 98, 50, 7, 0.25);
  s += shape([[8, 88], [88, 88], [94, 98], [4, 98]], C.lavD, C.plumSoft, { sw: SW, dx: 0, dy: 3 });
  const box = (x, y, w, h, c) => prism(x, y, w, h, 7, 5, [c[0], c[1]], [C.cream, C.creamD], [c[1], '#24324F'], { sw: SWs + 0.5, sdx: 3, sdy: 3 }) + shape(star(x + w / 2, y + h / 2, 7, 3.4, 5), C.gold, null, { sw: 1.5 });
  const pal = [[C.blue, C.blueD], [C.coral, C.coralD], [C.teal, C.tealD]];
  for (let i = 0; i < 3; i++) s += box(12 + i * 24, 54, 22, 32, pal[i]);
  for (let i = 0; i < 2; i++) s += box(24 + i * 24, 28, 22, 26, pal[(i + 1) % 3]);
  s += box(36, 4, 22, 24, pal[2]);
  return s;
});
add('ob_chest_freezer', () => {
  let s = shadowE(85, 80, 78, 7, 0.25);
  s += prism(10, 38, 140, 40, 16, 12, [C.white, C.frostD], [C.frost, C.frostD], [C.frostD, '#5AA6CE'], { sw: SW, sdx: 5, sdy: 4 });
  s += flat(rect(13, 52, 134, 8), C.blue) + flat(rect(13, 59, 134, 2), C.blueD);
  s += shape(rect(26, 20, 50, 16), C.frost, C.frostD, { sw: SWs, dx: 2, dy: 2 }) + shape(rect(86, 20, 50, 16), C.frost, C.frostD, { sw: SWs, dx: 2, dy: 2 });
  [[34, C.coral], [48, C.gold], [62, C.teal], [94, C.sky], [108, C.cream], [122, C.coral]].forEach(([x, c]) => { s += flat(rect(x - 3, 24, 10, 8), c, 'opacity=".9"'); });
  s += shape(rect(60, 64, 40, 8), C.chrome, C.chromeD, { sw: SWs, dx: 0, dy: 2 });
  s += snowflake(34, 62, 7, C.sky, 2) + flat([[10, 78], [34, 78], [10, 66]], C.white, 'opacity=".85"');
  return s;
});
add('ob_bread_rack', () => {
  let s = shadowE(60, 110, 54, 6, 0.25);
  const loaf = (cx, y, i) => shape(ellPath(cx, y, 12, 8), C.bread, C.breadD, { sw: SWs, dx: 2, dy: 2 }) + line([[cx - 6, y - 4], [cx - 3, y + 1]], C.breadL, 2) + line([[cx + 1, y - 5], [cx + 4, y]], C.breadL, 2);
  s += tube([[12, 18], [12, 108]], 3, C.chrome, 2) + tube([[96, 18], [96, 108]], 3, C.chrome, 2);
  [38, 64, 90].forEach((y, r) => {
    s += shape(rect(8, y, 92, 5), C.chrome, C.chromeD, { sw: SWs, dx: 0, dy: 2 });
    for (let i = 0; i < 4; i++) s += r === 1 ? shape(ellPath(26 + i * 20, y - 6, 4, 11), C.breadL, C.bread, { sw: SWs, dx: 2, dy: 2 }) : loaf(24 + i * 22, y - 7);
  });
  s += shape(rect(8, 12, 92, 8), C.coral, C.coralD, { sw: SWs, dx: 0, dy: 2 }) + flat(rect(14, 14, 24, 3), C.cream);
  s += `<circle cx="14" cy="108" r="4" fill="${C.plum}"/><circle cx="94" cy="108" r="4" fill="${C.plum}"/>`;
  return s;
});
add('ob_flour_sacks', () => {
  let s = shadowE(65, 80, 60, 7, 0.25);
  const sack = (x, y, w, h) => shape([[x, y + 8], [x + 8, y], [x + w - 8, y], [x + w, y + 8], [x + w, y + h - 6], [x + w - 10, y + h], [x + 10, y + h], [x, y + h - 6]], C.cream, C.creamD, { sw: SW, dx: 5, dy: 4 }) +
    flat([[x + 6, y + 4], [x + w * 0.5, y + 4], [x + 6, y + 18]], C.white, 'opacity=".7"') +
    shape(rect(x + 5, y + h * 0.42, w - 10, h * 0.28), C.coral, C.coralD, { sw: SWs, dx: 0, dy: 2 }) + shape(star(x + w / 2, y + h * 0.56, 6, 3, 6), C.gold, null, { sw: 1.5 }) +
    shape([[x + w * 0.3, y + 1], [x + w * 0.7, y + 1], [x + w * 0.62, y - 7], [x + w * 0.38, y - 7]], C.creamD, C.bread, { sw: SWs, dx: 2, dy: 0 });
  s += sack(8, 44, 46, 36) + sack(56, 44, 46, 36) + sack(32, 12, 46, 36);
  s += flat([[104, 76], [118, 78], [112, 72]], C.cream, 'opacity=".8"');
  return s;
});
add('ob_tv_boxes', () => {
  let s = shadowE(60, 98, 54, 6, 0.25);
  const box = (x, y, w, h, c, sh, deg) => rot(prism(x, y, w, h, 14, 9, [C.cream, C.creamD], [c, sh], [C.creamD, C.lav], { sw: SW, sdx: 4, sdy: 3 }) + shape(rect(x + 5, y + 6, w - 10, h - 18), '#241638', null, { sw: 2 }) + flat([[x + 7, y + 8], [x + w * 0.5, y + 8], [x + 7, y + h * 0.5]], C.teal, 'opacity=".5"') + flat(rect(x + 5, y + h - 9, w - 10, 4), C.coral), deg, x + w / 2, y + h);
  s += box(8, 58, 62, 38, '#FFFDF7', C.creamD, 0) + box(60, 66, 34, 30, '#FFFDF7', C.creamD, 3);
  s += box(18, 22, 46, 36, C.lavL, C.lav, -4);
  return s;
});
add('ob_cable_spool', () => {
  let s = shadowE(55, 92, 46, 6, 0.25);
  s += shape(ellPath(60, 52, 36, 36), C.bread, C.breadD, { sw: SW, dx: 3, dy: 3 });
  s += shape(ellPath(52, 56, 36, 36), C.breadL, C.bread, { sw: SW, dx: 4, dy: 4 });
  const rings = [C.teal, C.coral, C.teal, C.coral, C.gold];
  rings.forEach((c, i) => { const r = 31 - i * 4.5; s += `<circle cx="52" cy="56" r="${r}" fill="${c}" stroke="${C.plum}" stroke-width="2"/>`; });
  s += shape(ellPath(52, 56, 7, 7), C.plum, null, { sw: 1 }) + flat([[30, 40], [46, 28], [40, 38]], C.cream, 'opacity=".5"');
  s += tube([[78, 70], [90, 82], [100, 78], [102, 88]], 4, C.coral, 2) + shape(rect(98, 86, 8, 6), C.chrome, C.chromeD, { sw: 1.5, dx: 1, dy: 1 });
  return s;
});
add('ob_lane_divider', () => {
  let s = shadowE(90, 72, 82, 6, 0.25);
  s += prism(8, 44, 164, 24, 12, 8, [C.plumSoft, C.plum], [C.lav, C.lavD], [C.plum, '#1B1028'], { sw: SW, sdx: 4, sdy: 3 });
  for (let i = 0; i < 8; i++) s += flat(rect(14 + i * 20, 48, 10, 16), i % 2 ? C.gold : C.coral);
  s += shape(rect(12, 22, 156, 5), C.chrome, C.chromeD, { sw: SWs, dx: 0, dy: 2 }) + shape(rect(12, 34, 156, 5), C.chrome, C.chromeD, { sw: SWs, dx: 0, dy: 2 });
  const cc = [C.coral, C.gold, C.teal, C.sky, C.green, C.lavL];
  for (let i = 0; i < 12; i++) s += shape(rect(16 + i * 12.5, 12, 9, 10), cc[i % 6], null, { sw: 1.5 }) + (i < 11 ? shape(rect(16 + i * 12.5, 26 - 2, 9, 9), cc[(i + 2) % 6], null, { sw: 1.5 }) : '');
  s += shape(rect(76, 2, 28, 7), C.coral, C.coralD, { sw: SWs, dx: 1, dy: 1 });
  return s;
});
add('ob_bargain_bin', () => {
  let s = shadowE(70, 80, 62, 7, 0.25);
  const stuff = [[28, C.gold, 10], [48, C.teal, 12], [70, C.sky, 11], [92, C.coral, 12], [110, C.green, 9]];
  stuff.forEach(([x, c, r], i) => { s += shape(ellPath(x, 36 - (i % 2) * 6, r, r * 0.9), c, null, { sw: SWs }) + flat(rect(x - 3, 32 - (i % 2) * 6, 6, 4), C.cream, 'opacity=".8"'); });
  s += prism(10, 40, 116, 38, 12, 8, [C.coral, C.coralD], [C.cream, C.creamD], [C.coralD, '#8F2D27'], { sw: SW, sdx: 5, sdy: 4 });
  for (let i = 0; i < 9; i++) s += line([[20 + i * 12, 46], [20 + i * 12, 72]], C.cream, 2, 'opacity=".55"');
  s += line([[10, 58], [126, 58]], C.cream, 2, 'opacity=".55"');
  s += tube([[112, 40], [116, 6]], 3, C.chrome, 2) + shape(rect(92, 2, 40, 16), C.gold, C.goldD, { sw: SWs, dx: 2, dy: 2 }) + shape(star(112, 10, 6, 3, 5), C.coral, null, { sw: 1.5 });
  return s;
});
add('ob_manager_desk', () => {
  let s = shadowE(75, 90, 66, 7, 0.25);
  s += prism(10, 48, 124, 40, 14, 10, [C.bread, C.breadD], [C.breadL, C.bread], [C.breadD, '#8A5420'], { sw: SW, sdx: 5, sdy: 4 });
  s += shape(rect(20, 54, 46, 28), C.breadL, C.bread, { sw: SWs, dx: 2, dy: 2 }) + shape(rect(72, 54, 54, 28), C.breadL, C.bread, { sw: SWs, dx: 2, dy: 2 });
  s += shape(rect(38, 62, 10, 4), C.gold, null, { sw: 1.5 }) + shape(rect(94, 62, 10, 4), C.gold, null, { sw: 1.5 });
  s += shape(rect(30, 20, 30, 20), C.plum, null, { sw: SWs }) + shape(rect(33, 23, 24, 14), C.teal, C.tealD, { sw: 1.5, dx: 2, dy: 2 }) + shape(rect(41, 40, 14, 6), C.plumSoft, null, { sw: SWs });
  s += shape(rect(80, 34, 30, 10), C.cream, C.creamD, { sw: SWs, dx: 1, dy: 2 }) + shape(rect(84, 28, 30, 8), C.white, C.creamD, { sw: SWs, dx: 1, dy: 2 });
  s += shape(rect(70, 38, 18, 8), C.coral, C.coralD, { sw: SWs, dx: 1, dy: 1 });
  return s;
});

// department badges
const badge = (col, shade, inner, ring = null) => ell(64, 64, 58, 58, col, shade, { sw: 4.5, dx: 6, dy: 6 }) + `<circle cx="64" cy="64" r="50" fill="none" stroke="${ring ?? C.white}" stroke-width="2" opacity=".45"/>` + inner;
add('dept_main', () => badge('#B8DED2', '#94C9B9',
  tube([[34, 56], [40, 30], [88, 30], [94, 56]], 3.5, C.chromeD, 2.5) + S3([[26, 54], [102, 54], [92, 98], [36, 98]], C.chromeL, C.chrome) + [48, 64, 80].map((x) => line([[x, 56], [x - 2 + (x - 64) * 0.1, 96]], C.chromeD, 2)).join('') + line([[30, 74], [98, 74]], C.chromeD, 2) +
  loaf(50, 48, 11) + shape(star(78, 46, 11, 5, 5), C.gold, C.goldD, { sw: 2.5, dx: 1.5, dy: 1.5 }).replace(/<path/, '<path') ));
function S3(g, f, sh) { return shape(g, f, sh, { sw: 3.5, dx: 4, dy: 4 }); }
add('dept_frozen', () => badge('#9FD8F0', '#6FB7D8', snowflake(58, 60, 32, C.plum, 11) + snowflake(58, 60, 32, C.white, 6) +
  `<g transform="rotate(18 98 90)">` + S3([[90, 70], [108, 70], [108, 96], [90, 96]], C.coral, C.coralD) + shape(rect(97, 96, 4, 16), C.breadL, C.breadD, { sw: 2, dx: 1, dy: 0 }) + flat(rect(93, 73, 4, 16), C.coralL, 'opacity=".8"') + `</g>`));
add('dept_bakery', () => badge('#E0916A', '#C06F4A',
  bgt(60, 52, 84, -38).replace('stroke-width="2"', 'stroke-width="3"') + `<g transform="translate(64 86) scale(2.3)">` + croissant(0, 0, 1).replace(/stroke-width="2"/g, 'stroke-width="1.4"') + `</g>`));
add('dept_electronics', () => badge('#4E6B78', '#3A5260',
  tube([[64, 90], [64, 108]], 5, C.chromeD, 3) + S3([[38, 52], [90, 52], [90, 92], [38, 92]], C.cream, C.creamD) + shape(rect(46, 28, 8, 24), C.chrome, C.chromeD, { sw: 3, dx: 2, dy: 0 }) + shape(rect(74, 28, 8, 24), C.chrome, C.chromeD, { sw: 3, dx: 2, dy: 0 }) +
  shape([[68, 46], [52, 72], [64, 72], [58, 98], [78, 66], [66, 66], [74, 46]], C.gold, C.goldD, { sw: 3.5, dx: 2, dy: 2 }), '#7FA3B0'));
add('dept_checkout', () => badge(C.coral, C.coralD,
  shape([[58, 24], [88, 24], [88, 54], [78, 50], [74, 56], [68, 50], [58, 56]], C.cream, C.creamD, { sw: 3, dx: 3, dy: 0 }) + line([[63, 32], [82, 32]], C.chromeD, 2) + line([[63, 39], [82, 39]], C.chromeD, 2) +
  prism(28, 70, 60, 28, 18, 12, [C.teal, C.tealD], [C.plumSoft, C.plum], [C.tealD, '#1D6A60'], { sw: 3.5 }) + shape(rect(36, 74, 22, 12), '#241638', null, { sw: 2.5 }) + flat(rect(40, 78, 12, 3), C.gold) + shape(rect(62, 76, 18, 7), C.cream, C.creamD, { sw: 2, dx: 0, dy: 2 }), C.white));
add('dept_boss', () => badge('#4A3560', '#30203F',
  shape([[30, 28], [98, 26], [102, 76], [26, 78]], C.coral, C.coralD, { sw: 3.5, dx: 4, dy: 4 }) + shape([[36, 34], [94, 33], [96, 70], [32, 72]], '#241638', null, { sw: 2.5 }) +
  shape([[40, 44], [58, 41], [58, 55], [42, 58]], C.gold, C.goldD, { sw: 2.2, dx: 1.5, dy: 1.5 }) + shape([[88, 44], [70, 41], [70, 55], [86, 58]], C.gold, C.goldD, { sw: 2.2, dx: 1.5, dy: 1.5 }) +
  brow(38, 36, 60, 46, 5).replace(C.plum, C.cream) + brow(90, 36, 68, 46, 5).replace(C.plum, C.cream) + brow(38, 37, 60, 47, 3) + brow(90, 37, 68, 47, 3) +
  shape([[28, 80], [100, 80], [96, 100], [32, 100]], C.chrome, C.chromeD, { sw: 3, dx: 2, dy: 3 }) + [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${38 + i * 10.4}" cy="${90}" r="4.2" fill="${C.gold}" stroke="${C.plum}" stroke-width="1.8"/>`).join('') +
  shape([[56, 100], [70, 100], [76, 118], [64, 122], [52, 118]], C.teal, C.tealD, { sw: 3, dx: 2, dy: 2 }), C.gold).replace(`stroke="${C.plum}" stroke-width="4.5"`, `stroke="${C.gold}" stroke-width="4.5"`));

// =====================================================================================
// AOE / MULTI-HIT ITEMS
// =====================================================================================
const cloud = (cs, fill, op = 1) => cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2.5}" fill="${C.plum}" opacity="${op}"/>`).join('') + cs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.creamD}"/>`).join('') + cs.map(([x, y, r]) => `<circle cx="${x - 1.5}" cy="${y - 2}" r="${r - 3}" fill="${fill}"/>`).join('');

add('icon_cooker', () => {
  let s = cloud([[96, 22, 11], [112, 26, 9], [82, 28, 8], [100, 34, 8]], C.cream);
  s += S5([[34, 96], [158, 96], [150, 158], [42, 158]], C.chrome, C.chromeD, { dx: 9, dy: 5 });
  s += flat([[42, 104], [54, 104], [60, 150], [50, 150]], C.white, 'opacity=".8"');
  s += S5([[22, 96], [170, 96], [170, 106], [22, 106]], C.chromeD, '#7C8599', { dx: 0, dy: 3, sw: 4 });
  s += S5([[34, 98], [158, 98], [144, 68], [48, 68]], C.chromeL, C.chrome, { dx: 8, dy: 4 });
  s += S5(rect(88, 92, 18, 14), C.plumSoft, C.plum, { dx: 2, dy: 2, sw: 4 });
  s += tube([[64, 68], [64, 56], [132, 56], [132, 68]], 7, C.coral, 4);
  s += S5([[88, 56], [104, 56], [104, 46], [88, 46]], C.gold, C.goldD, { dx: 3, dy: 0, sw: 4 }) + shape(rect(84, 42, 24, 7), C.goldD, null, { sw: 3.5 });
  s += S5(rect(8, 110, 18, 12), C.coral, C.coralD, { dx: 0, dy: 3, sw: 4 }) + S5(rect(166, 110, 18, 12), C.coral, C.coralD, { dx: 0, dy: 3, sw: 4 });
  s += `<circle cx="126" cy="128" r="14" fill="${C.cream}" stroke="${C.plum}" stroke-width="5"/><path d="M114 128 A12 12 0 0 1 138 128" fill="none" stroke="${C.soda}" stroke-width="4"/>` + line([[126, 128], [132, 119]], C.plum, 3) + `<circle cx="126" cy="128" r="2.6" fill="${C.plum}"/>`;
  s += flat([[58, 72], [80, 72], [60, 90]], C.white, 'opacity=".8"');
  return icon(s, 170);
});

add('icon_spray', () => {
  let s = S5([[60, 90], [122, 90], [130, 110], [130, 164], [120, 172], [62, 172], [52, 164], [52, 110]], C.teal, C.tealD, { dx: 9, dy: 4 });
  s += flat([[58, 100], [68, 100], [64, 164], [58, 160]], '#7FE0D2', 'opacity=".85"');
  s += shape([[60, 118], [122, 118], [122, 154], [60, 154]], C.cream, C.creamD, { sw: 3.5, dx: 3, dy: 3 }) + shape(star(91, 136, 12, 6, 5), C.coral, null, { sw: 2.5 });
  s += S5([[78, 68], [104, 68], [106, 92], [76, 92]], C.tealD, null);
  s += S5([[104, 70], [126, 74], [122, 98], [110, 94]], C.coral, C.coralD, { dx: 3, dy: 2, sw: 4.5 });
  s += S5([[60, 40], [114, 38], [114, 68], [60, 70]], C.coral, C.coralD, { dx: 6, dy: 5 });
  s += S5([[114, 44], [138, 47], [138, 60], [114, 62]], C.coralD, null, { sw: 4.5 }) + `<circle cx="138" cy="54" r="3" fill="${C.plum}"/>`;
  s += flat([[64, 44], [100, 43], [64, 52]], C.coralL, 'opacity=".8"');
  for (const [x, y, r] of [[150, 40, 4.4], [164, 52, 4], [152, 64, 3.4], [174, 36, 3.2], [180, 64, 4.2], [168, 78, 3.2], [150, 80, 3], [184, 48, 2.8]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.cream}" stroke="${C.plum}" stroke-width="1.8"/>`;
  return icon(s, 176);
});

add('icon_leafblower', () => {
  // handheld leaf blower: orange motor body, grip, long nozzle pointing right, a few leaves in the gust
  let s = '';
  s += line([[132, 96], [160, 90], [186, 94]], C.frost, 4, 'opacity=".9"') + line([[132, 108], [168, 108], [186, 112]], C.frost, 4, 'opacity=".9"');
  s += S5([[96, 82], [140, 82], [150, 92], [150, 118], [140, 128], [96, 128]], C.coral, C.coralD, { dx: 7, dy: 5 });
  s += S5([[140, 86], [176, 92], [176, 118], [140, 124]], C.chrome, C.chromeD, { dx: 5, dy: 4 });
  s += flat([[144, 94], [170, 98], [170, 104], [144, 102]], C.chromeL, 'opacity=".8"');
  s += S5([[44, 70], [96, 66], [100, 100], [96, 140], [44, 142], [38, 106]], C.coral, C.coralD, { dx: 7, dy: 6 });
  s += ell(66, 104, 14, 16, C.cream, C.creamD, { sw: 3.5, dx: 2, dy: 2 }) + line([[58, 104], [74, 104]], C.plum, 3);
  s += S5([[76, 126], [96, 126], [92, 168], [72, 170]], C.plumSoft, C.plum, { dx: 4, dy: 3 });
  s += flat([[48, 76], [86, 72], [50, 84]], C.coralL, 'opacity=".8"');
  for (const [x, y, a, col] of [[160, 54, -30, C.green], [180, 138, 40, C.gold], [128, 142, 150, C.coral]]) s += rot(ell(x, y, 13, 7, col, C.plum, { sw: 3 }) + line([[x - 10, y], [x + 10, y]], C.plum, 2), a, x, y);
  return icon(s, 176);
});

add('icon_sourdough', () => {
  // glass jar of bubbly dough, cloth lid held by a rubber band
  let s = '';
  s += S5([[50, 62], [142, 62], [154, 82], [154, 158], [38, 158], [38, 82]], '#E4F4F8', '#B7DCE6', { dx: 7, dy: 0 });
  s += S5([[42, 104], [150, 104], [150, 154], [42, 154]], C.creamD, C.breadL, { sw: 3, dx: 0, dy: 0 });
  s += flat([[42, 104], [60, 98], [80, 106], [100, 98], [122, 106], [150, 100], [150, 112], [42, 112]], C.cream);
  for (const [x, y, r] of [[62, 128, 7], [92, 138, 9], [120, 124, 6], [78, 118, 4], [108, 146, 4], [134, 140, 5]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.cream}" stroke="${C.breadD}" stroke-width="2.2"/>`;
  s += flat([[44, 74], [52, 74], [50, 150], [44, 144]], C.white, 'opacity=".55"');
  s += S5([[34, 50], [150, 50], [158, 66], [26, 66]], C.coral, C.coralD, { dx: 0, dy: 4, sw: 4 });
  s += flat([[34, 54], [150, 54], [154, 60], [30, 60]], C.cream, 'opacity=".6"');
  s += line([[34, 76], [150, 76]], C.gold, 5) + line([[38, 80], [146, 80]], C.goldD, 2);
  return icon(s, 164);
});

// Perishables: `icon_<id>` is fresh, `icon_<id>_rotten` the spoiled look (ItemContent.look). Same silhouette, different material colours.
const avocadoIcon = (rotten) => {
  const skin = rotten ? '#5A4030' : C.greenD, skinS = rotten ? '#3E2A20' : '#3F7A2A', flesh = rotten ? '#A58558' : '#E4EE9C', fleshS = rotten ? '#7C6240' : '#C4D86E', pit = rotten ? '#2E2018' : C.breadD;
  const body = (cx, cy, rx, ry) => ell(cx, cy, rx, ry, skin, skinS, { sw: SWi, dx: 6, dy: 5 });
  let s = body(96, 112, 56, 50) + body(96, 64, 32, 40);
  s += ell(96, 112, 44, 38, flesh, fleshS, { sw: 3, dx: 0, dy: 0 }) + ell(96, 66, 22, 30, flesh, fleshS, { sw: 0, dx: 0, dy: 0 });
  s += ell(96, 116, 21, 22, pit, null, { sw: 4 }) + flat(ellPath(88, 108, 6, 8), rotten ? '#5A4030' : C.breadL, 'opacity=".8"');
  if (rotten) for (const [x, y, r] of [[66, 100, 6], [124, 128, 7], [104, 74, 5], [74, 134, 4]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#3E2A20" opacity=".85"/>`;
  else s += flat([[58, 98], [66, 90], [70, 104]], C.white, 'opacity=".6"');
  return icon(s, 166);
};
add('icon_avocado', () => avocadoIcon(false));
add('icon_avocado_rotten', () => avocadoIcon(true));

const fishIcon = (rotten) => {
  const body = rotten ? '#8FA68A' : C.sky, bodyS = rotten ? '#6C846A' : '#4F9FC9', belly = rotten ? '#C9CDA0' : C.chromeL, fin = rotten ? '#6C846A' : C.blue;
  let s = S5([[150, 104], [186, 74], [180, 104], [186, 134]], fin, rotten ? '#4F6350' : C.blueD, { dx: 4, dy: 4 });
  s += ell(98, 104, 62, 36, body, bodyS, { sw: SWi, dx: 6, dy: 5 });
  s += flat(ellPath(96, 118, 48, 16), belly, 'opacity=".9"');
  s += S5([[88, 70], [112, 52], [128, 74]], fin, rotten ? '#4F6350' : C.blueD, { dx: 3, dy: 3 });
  s += line([[64, 88], [60, 118]], C.plum, 4);
  if (rotten) {
    s += line([[40, 88], [58, 100]], C.plum, 5) + line([[58, 88], [40, 100]], C.plum, 5);
    for (const [x, y] of [[100, 92], [118, 100], [86, 106], [126, 114]]) s += `<circle cx="${x}" cy="${y}" r="3.5" fill="#6C846A"/>`;
    for (const x of [74, 98, 122]) s += curve(`M${x} 56 C${x - 10} 44 ${x + 10} 34 ${x} 20`, 3.5, '#9BBF6A', 2);
  } else {
    s += `<circle cx="48" cy="96" r="9" fill="${C.white}" stroke="${C.plum}" stroke-width="3.5"/><circle cx="46" cy="97" r="4" fill="${C.plum}"/>`;
    for (const [x, y] of [[100, 92], [118, 100], [86, 106], [126, 114]]) s += `<circle cx="${x}" cy="${y}" r="3.5" fill="${C.chromeL}"/>`;
    s += flat([[72, 82], [110, 72], [96, 84]], C.white, 'opacity=".6"');
  }
  return icon(s, 160);
};
add('icon_fish', () => fishIcon(false));
add('icon_fish_rotten', () => fishIcon(true));

add('icon_basil', () => {
  let s = '';
  const leaf = (x, y, a, big = 1) => rot(ell(x, y, 22 * big, 12 * big, C.green, C.greenD, { sw: 3.5, dx: 2, dy: 3 }) + line([[x - 16 * big, y], [x + 16 * big, y]], C.greenD, 2), a, x, y);
  s += line([[96, 96], [96, 56]], C.greenD, 6);
  s += leaf(66, 62, -35) + leaf(126, 62, 35) + leaf(72, 92, -20, 0.9) + leaf(120, 92, 20, 0.9) + leaf(96, 36, -90, 0.95);
  s += S5([[52, 106], [140, 106], [128, 166], [64, 166]], C.coral, C.coralD, { dx: 7, dy: 5 });
  s += S5([[46, 98], [146, 98], [146, 114], [46, 114]], C.coralL, C.coral, { dx: 4, dy: 3 });
  s += flat([[60, 120], [70, 120], [76, 158], [70, 158]], C.white, 'opacity=".45"');
  return icon(s, 170);
});

add('icon_scoby', () => {
  let s = '';
  s += S5([[54, 52], [138, 52], [152, 74], [152, 158], [40, 158], [40, 74]], '#E4F4F8', '#B7DCE6', { dx: 7, dy: 0 });
  s += S5([[44, 84], [148, 84], [148, 154], [44, 154]], '#E8A93C', '#C27F1E', { sw: 3, dx: 0, dy: 0 });
  s += ell(96, 90, 44, 12, '#F6E3B8', '#DDBE86', { sw: 3.5, dx: 0, dy: 2 });
  s += ell(96, 118, 36, 11, '#F6E3B8', '#DDBE86', { sw: 3, dx: 0, dy: 2 });
  for (const [x, y, r] of [[62, 134, 5], [124, 142, 6], [86, 146, 3.5], [134, 110, 4]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#F9D27A" stroke="#C27F1E" stroke-width="2"/>`;
  s += flat([[46, 60], [54, 60], [52, 150], [46, 142]], C.white, 'opacity=".55"');
  s += S5([[40, 40], [152, 40], [156, 56], [36, 56]], C.teal, C.tealD, { dx: 0, dy: 4, sw: 4 });
  return icon(s, 164);
});

add('icon_popper', () => {
  const tip = [34, 168], A = [66, 90], B = [128, 128], cone = [tip, A, B];
  const at = (t) => [[tip[0] + (A[0] - tip[0]) * t, tip[1] + (A[1] - tip[1]) * t], [tip[0] + (B[0] - tip[0]) * t, tip[1] + (B[1] - tip[1]) * t]];
  let s = '';
  const streamers = [['M96 84 C100 40 130 64 138 24', C.teal], ['M112 94 C150 80 140 50 176 52', C.coral], ['M84 80 C70 50 96 40 84 12', C.gold]];
  s += streamers.map(([d, c]) => curve(d, 4, c, 2.5)).join('');
  s += S5(cone, C.gold, C.goldD, { dx: 5, dy: 5 });
  for (let i = 0; i < 5; i++) { const [p0, q0] = at(0.15 + i * 0.17), [p1, q1] = at(0.15 + i * 0.17 + 0.085); s += flat([p0, q0, q1, p1], C.coral); }
  s += shape(cone, 'none', null, { sw: SWi }).replace('fill="none"', 'fill="none"');
  s += `<path d="M${A[0]} ${A[1]} L${B[0]} ${B[1]}" stroke="${C.plum}" stroke-width="9" stroke-linecap="round"/><path d="M${A[0]} ${A[1]} L${B[0]} ${B[1]}" stroke="${C.cream}" stroke-width="3.5" stroke-linecap="round"/>`;
  const cf = [[110, 56, C.coral, 20], [138, 74, C.teal, -30], [150, 36, C.gold, 50], [122, 28, C.sky, 10], [168, 90, C.coral, -20], [96, 22, C.lavL, 35], [160, 62, C.green, 70], [176, 28, C.gold, -10]];
  s += cf.map(([x, y, c, d]) => rot(shape(rect(x - 6, y - 3.5, 12, 7), c, null, { sw: 2.5 }), d, x, y)).join('');
  s += spk(70, 40, 7) + spk(184, 76, 6);
  return icon(s, 176);
});

add('icon_popcorn', () => {
  const kern = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r + 2.5}" fill="${C.plum}"/><circle cx="${x}" cy="${y}" r="${r}" fill="#FFF2B8"/><circle cx="${x - 2}" cy="${y - 2}" r="${r * 0.45}" fill="${C.gold}"/>`;
  let s = [[70, 62, 13], [96, 50, 15], [124, 62, 13], [84, 38, 11], [112, 36, 11], [100, 26, 9]].map(([x, y, r]) => kern(x, y, r)).join('');
  s += S5([[46, 76], [150, 76], [138, 164], [58, 164]], C.cream, C.creamD, { dx: 8, dy: 5 });
  for (let i = 0; i < 4; i++) s += flat([[58 + i * 26, 76], [71 + i * 26, 76], [67 + i * 24, 164], [58 + i * 24, 164]].map(([x, y]) => [x, y]), C.coral);
  s += shape([[42, 74], [154, 74], [154, 86], [42, 86]], C.coral, C.coralD, { sw: SWi, dx: 0, dy: 3 });
  s += flat([[52, 92], [60, 92], [64, 150], [58, 150]], C.white, 'opacity=".7"');
  s += spk(150, 40, 8);
  return icon(s, 170);
});

add('icon_sparklers', () => {
  const stick = (x0, y0, x1, y1) => line([[x0, y0], [x1, y1]], C.plum, 9) + line([[x0, y0], [x1, y1]], C.chrome, 4.5);
  let s = stick(60, 170, 100, 74) + stick(122, 170, 96, 74);
  s += line([[60, 170], [70, 146]], C.coral, 9) + line([[122, 170], [116, 148]], C.teal, 9);
  s += [[100, 62, 26], [58, 70, 14], [146, 66, 15], [80, 30, 11], [124, 34, 11]].map(([x, y, r]) => `<g stroke="${C.plum}" stroke-width="3.5" stroke-linecap="round">${[0, 45, 90, 135].map((d) => { const a = d * Math.PI / 180; return `<path d="M${x - Math.cos(a) * r} ${y - Math.sin(a) * r} L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}"/>`; }).join('')}</g>`).join('');
  s += [[100, 62, 26], [58, 70, 14], [146, 66, 15], [80, 30, 11], [124, 34, 11]].map(([x, y, r], i) => `<g stroke="${i % 2 ? C.gold : '#FFF2B8'}" stroke-width="1.8" stroke-linecap="round">${[0, 45, 90, 135].map((d) => { const a = d * Math.PI / 180; return `<path d="M${x - Math.cos(a) * r} ${y - Math.sin(a) * r} L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}"/>`; }).join('')}</g>`).join('');
  s += spk(100, 62, 9) + spk(30, 110, 6) + spk(172, 100, 7);
  return icon(s, 176);
});

add('icon_fireextinguisher', () => {
  let s = line([[112, 46], [150, 40], [158, 74], [140, 98]], C.plum, 9) + line([[112, 46], [150, 40], [158, 74], [140, 98]], '#5A4A6E', 4);
  s += S5([[62, 62], [120, 62], [124, 168], [58, 168]], C.coral, C.coralD, { dx: 7, dy: 5 });
  s += S5([[70, 44], [112, 44], [116, 62], [66, 62]], C.chrome, C.creamD, { dx: 4, dy: 3, sw: 4.5 });
  s += S5([[80, 28], [102, 28], [102, 44], [80, 44]], C.plum, null, { sw: 4 });
  s += S5([[66, 98], [118, 98], [118, 128], [66, 128]], C.cream, C.creamD, { dx: 4, dy: 3, sw: 4 });
  s += flat([[72, 70], [80, 70], [76, 160], [68, 160]], C.white, 'opacity=".4"');
  s += spk(150, 130, 7);
  return icon(s, 176);
});

add('icon_airhorn', () => {
  let s = S5([[34, 80], [78, 80], [78, 128], [34, 128]], C.coral, C.coralD, { dx: 5, dy: 4 });
  s += S5([[78, 70], [150, 30], [166, 56], [166, 150], [150, 178], [78, 138]], C.gold, C.goldD, { dx: 8, dy: 6 });
  s += flat([[88, 80], [140, 56], [140, 70], [92, 98]], C.white, 'opacity=".5"');
  s += shape([[24, 96], [34, 96], [34, 112], [24, 112]], C.plum, null, { sw: 4 });
  s += `<g stroke="${C.plum}" stroke-width="5" stroke-linecap="round" fill="none"><path d="M176 74 Q188 104 176 134"/><path d="M168 56 Q192 104 168 152" opacity=".6"/></g>`;
  s += spk(50, 56, 8);
  return icon(s, 176);
});

add('icon_snowcone', () => {
  let s = S5([[62, 82], [134, 82], [98, 168]], C.cream, C.creamD, { dx: 6, dy: 5 });
  for (let i = 0; i < 3; i++) s += flat([[70 + i * 12, 88], [78 + i * 12, 88], [98, 150]].map(([x, y]) => [x, y]), C.coral, 'opacity=".55"');
  s += [[78, 70, 22, C.sky], [118, 70, 22, C.teal], [98, 52, 24, '#EAF7FF']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="${C.plum}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="${C.white}" opacity=".8"/>`).join('');
  s += spk(140, 40, 8) + spk(52, 52, 6);
  return icon(s, 172);
});

add('icon_ovenmitts', () => {
  const mitt = (dx, fill, shade) => `<g transform="translate(${dx} 0)">` + S5([[38, 144], [36, 84], [44, 50], [62, 42], [80, 54], [84, 94], [98, 80], [110, 88], [104, 118], [88, 146]], fill, shade, { dx: 5, dy: 5 }) + line([[42, 130], [86, 130]], C.cream, 7) + line([[54, 68], [66, 82], [52, 98], [70, 116]], C.plumSoft, 2) + '</g>';
  return icon(mitt(-14, C.coral, C.coralD) + mitt(50, C.mint, C.mintD), 164);
});

add('icon_soup', () => {
  let s = S5([[50, 50], [144, 50], [144, 152], [50, 152]], C.chrome, C.chromeD, { dx: 6, dy: 4 });
  s += ell(97, 50, 47, 14, C.chromeL, C.chromeD, { sw: 5 });
  s += flat([[54, 74], [140, 74], [140, 134], [54, 134]], C.coral);
  s += S5([[68, 100], [126, 100], [116, 120], [80, 120]], C.cream, C.creamD, { sw: 3 });
  s += line([[82, 93], [78, 84], [84, 78]], C.white, 3) + line([[104, 93], [100, 84], [106, 78]], C.white, 3);
  s += line([[54, 144], [140, 144]], C.chromeL, 4);
  return icon(s, 170);
});

add('icon_helmet', () => {
  let s = S5([[40, 116], [46, 78], [66, 50], [96, 38], [128, 50], [150, 78], [156, 116]], C.gold, C.goldD, { dx: 7, dy: 6 });
  s += S5([[86, 40], [106, 40], [112, 116], [80, 116]], C.gold, C.goldD, { sw: 4 });
  s += S5([[28, 116], [166, 116], [170, 134], [26, 134]], C.gold, C.goldD, { sw: 5 });
  s += line([[52, 140], [60, 160], [132, 160], [144, 140]], C.plumSoft, 6);
  s += spk(150, 42, 7);
  return icon(s, 170);
});

add('icon_peas', () => {
  let s = S5([[54, 36], [136, 36], [148, 154], [128, 166], [60, 160], [44, 148]], C.frost, C.frostD, { dx: 6, dy: 6 });
  s += line([[56, 50], [134, 50]], C.white, 6);
  s += S5([[56, 78], [132, 78], [132, 142], [56, 142]], C.green, C.greenD, { sw: 3 });
  for (const [x, y] of [[76, 100], [108, 99], [92, 125]]) s += ell(x, y, 13, 12, C.greenL, C.greenD, { sw: 3 });
  s += line([[96, 58], [96, 74]], C.sky, 3) + line([[88, 62], [104, 70]], C.sky, 3) + line([[104, 62], [88, 70]], C.sky, 3);
  return icon(s, 172);
});

add('icon_sandwich', () => {
  let s = S5([[34, 138], [132, 42], [162, 142]], C.bread, C.breadD, { dx: 5, dy: 5 });
  s += S5([[36, 126], [132, 30], [162, 130]], C.cream, C.creamD, { dx: 5, dy: 5 });
  s += flat([[42, 134], [158, 137], [148, 146], [56, 143]], C.green);
  s += flat([[58, 146], [150, 148], [144, 155], [66, 153]], C.coral);
  s += S5([[34, 154], [158, 158], [156, 170], [38, 166]], C.bread, C.breadD, { sw: 4 });
  s += ell(116, 94, 18, 18, C.coral, C.coralD, { sw: 3 });
  s += flat([[112, 82], [120, 82], [120, 90], [128, 90], [128, 98], [120, 98], [120, 106], [112, 106], [112, 98], [104, 98], [104, 90], [112, 90]], C.white);
  return icon(s, 174);
});

add('icon_blanket', () => {
  let s = S5([[38, 44], [142, 36], [160, 150], [54, 164]], C.lav, C.lavD, { dx: 7, dy: 6 });
  s += line([[72, 44], [86, 156]], C.lavL, 5) + line([[110, 40], [126, 152]], C.lavL, 5);
  s += line([[44, 82], [148, 74]], C.lavL, 5) + line([[48, 120], [154, 110]], C.lavL, 5);
  s += S5([[38, 44], [142, 36], [146, 60], [42, 68]], C.mint, C.mintD, { sw: 4 });
  for (let i = 0; i < 7; i++) s += line([[58 + i * 14, 164 - i * 2], [60 + i * 14, 174 - i * 2]], C.plumSoft, 3);
  return icon(s, 176);
});

add('icon_rubberboots', () => {
  const boot = (dx, fill, shade) => `<g transform="translate(${dx} 0)">` + S5([[40, 42], [82, 42], [82, 118], [104, 130], [108, 152], [38, 152]], fill, shade, { dx: 5, dy: 5 }) + line([[44, 52], [78, 52]], C.gold, 6) + line([[42, 144], [102, 144]], C.plumSoft, 6) + '</g>';
  return icon(boot(44, C.greenD, C.plumSoft) + boot(-14, C.green, C.greenD), 170);
});

add('icon_thermos', () => {
  let s = S5([[62, 52], [128, 52], [138, 142], [126, 162], [64, 162], [54, 142]], C.teal, C.tealD, { dx: 6, dy: 5 });
  s += S5([[60, 34], [130, 34], [130, 62], [60, 62]], C.chrome, C.chromeD, { sw: 5 });
  s += line([[68, 42], [122, 42]], C.chromeL, 4);
  s += line([[128, 76], [154, 76], [154, 118], [136, 118]], C.plumSoft, 10);
  s += flat([[70, 74], [80, 74], [78, 138], [68, 136]], C.mintL);
  s += S5([[92, 96], [120, 96], [118, 116], [106, 128], [94, 116]], C.gold, C.goldD, { sw: 3 });
  return icon(s, 172);
});

add('icon_insurance', () => {
  let s = S5([[44, 30], [128, 30], [150, 54], [150, 162], [44, 162]], C.cream, C.creamD, { dx: 6, dy: 5 });
  s += S5([[128, 30], [128, 54], [150, 54]], C.gold, C.goldD, { sw: 3 });
  s += line([[62, 62], [116, 62]], C.plumSoft, 5) + line([[62, 78], [130, 78]], C.plumSoft, 4) + line([[62, 94], [108, 94]], C.plumSoft, 4);
  s += S5([[76, 108], [124, 108], [122, 138], [100, 156], [78, 138]], C.gold, C.goldD, { sw: 4 });
  s += line([[86, 126], [98, 138], [114, 118]], C.white, 5);
  s += spk(156, 104, 8);
  return icon(s, 172);
});

add('icon_tomato', () => {
  let s = S5([[44, 84], [62, 62], [94, 60], [122, 64], [150, 88], [152, 128], [130, 158], [92, 166], [56, 148], [38, 118]], C.coral, C.coralD, { dx: 8, dy: 6 });
  s += S5([[92, 62], [72, 48], [92, 48], [102, 26], [110, 48], [136, 44], [120, 62], [132, 78], [106, 68], [90, 82]], C.greenD, C.plumSoft, { sw: 4 });
  s += flat([[56, 90], [68, 76], [86, 76], [70, 102]], C.coralL);
  s += [[120, 112, 16], [78, 138, 10], [132, 140, 8]].map(([x, y, r]) => ell(x, y, r, r * 0.8, C.green, C.greenD, { sw: 3, dx: 2, dy: 2 })).join('');
  s += line([[48, 62], [40, 48], [48, 34]], C.greenD, 4);
  return icon(s, 172);
});

add('proj_tomato', () => {
  let s = shape([[4, 10], [10, 5], [21, 6], [27, 14], [25, 23], [17, 27], [7, 24], [2, 17]], C.coral, C.coralD, { sw: 2, dx: 2, dy: 2 });
  s += shape([[11, 7], [9, 2], [15, 5], [20, 1], [20, 7], [25, 9], [17, 10]], C.greenD, null, { sw: 1.5 });
  s += flat(ellPath(20, 18, 4, 3), C.green);
  return s;
});

add('icon_moldybread', () => {
  let s = S5([[48, 150], [148, 150], [152, 96], [140, 70], [104, 58], [64, 70], [46, 96]], C.bread, C.breadD, { dx: 6, dy: 5 });
  s += flat([[60, 88], [76, 74], [96, 70], [90, 82], [68, 98]], C.cream, 'opacity=".55"');
  s += [[70, 108, 13], [112, 94, 16], [128, 126, 11], [88, 130, 9], [96, 82, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2.5}" fill="${C.plum}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${C.green}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.35}" fill="#CFEFA6"/>`).join('');
  s += [[150, 60, 5], [44, 70, 4], [160, 100, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.green}" stroke="${C.plum}" stroke-width="1.6"/>`).join('');
  return icon(s, 164);
});

add('icon_bowlingball', () => {
  let s = ell(98, 100, 62, 62, C.plumSoft, C.plum, { sw: SWi, dx: 6, dy: 5 });
  s += flat(ellPath(78, 74, 20, 12), C.lavL, 'opacity=".55"');
  s += [[84, 84], [108, 78], [98, 106]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="${C.plum}"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="3" fill="${C.lav}" opacity=".6"/>`).join('');
  s += spk(150, 52, 8);
  return icon(s, 168);
});

add('icon_balloon', () => {
  let s = line([[98, 124], [92, 140], [104, 152], [98, 168]], C.plum, 4.5);
  s += S5([[90, 122], [106, 122], [98, 132]], C.coralD, null, { sw: 3.5 });
  s += ell(98, 78, 46, 54, C.coral, C.coralD, { sw: SWi, dx: 6, dy: 5 });
  s += flat(ellPath(80, 56, 11, 20), C.white, 'opacity=".5"');
  s += spk(150, 34, 7);
  return icon(s, 170);
});

add('icon_ghostpepper', () => {
  let s = S5([[104, 34], [116, 22], [126, 34], [118, 52]], C.green, C.greenD, { sw: 4.5 });
  s += S5([[40, 70], [74, 46], [128, 50], [150, 84], [134, 128], [96, 168], [78, 124], [44, 104]], C.coral, C.coralD, { dx: 7, dy: 5 });
  s += flat([[58, 76], [78, 60], [92, 62], [74, 92]], C.coralL, 'opacity=".6"');
  s += `<g transform="translate(106 110)">` + flat([[0, -16], [8, -4], [14, -14], [12, 10], [0, 16], [-12, 10], [-14, -12], [-6, -4]], C.gold) + `</g>`;
  s += flat([[104, 100], [110, 110], [102, 116]], C.white, 'opacity=".8"');
  s += spk(36, 40, 7);
  return icon(s, 172);
});

add('icon_scratchticket', () => {
  let s = rot(S5(rect(46, 56, 112, 78), C.cream, C.creamD, { dx: 7, dy: 5 }), -8, 102, 95);
  s += rot(flat(rect(58, 68, 88, 20), C.coral) + flat(rect(58, 96, 88, 26), '#B8B8C4') + [[72, 109], [102, 109], [132, 109]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${C.chromeL}"/>`).join('') + `<circle cx="132" cy="109" r="7" fill="${C.gold}"/>`, -8, 102, 95);
  s += line([[70, 148], [120, 160]], C.plum, 4.5) + spk(150, 50, 8) + spk(46, 140, 6);
  return icon(s, 172);
});

const keyArt = (body, bodyD, tag) => {
  let s = `<circle cx="60" cy="62" r="34" fill="${C.plum}"/><circle cx="60" cy="62" r="28" fill="${body}"/><circle cx="60" cy="62" r="11" fill="${C.plum}"/>`;
  s += flat([[34, 50], [50, 36], [58, 38]], GL, 'opacity=".7"');
  s += shape(rect(84, 56, 84, 14), body, bodyD, { sw: SWi, dx: 3, dy: 4 });
  s += shape(rect(140, 70, 12, 24), body, bodyD, { sw: SWi, dx: 2, dy: 3 }) + shape(rect(118, 70, 12, 16), body, bodyD, { sw: SWi, dx: 2, dy: 3 });
  s += tag;
  return s;
};

add('icon_shortcut', () => {
  let s = keyArt(C.gold, C.goldD, '');
  s += rot(shape(rect(34, 108, 60, 38), C.cream, C.creamD, { sw: SWi, dx: 3, dy: 4 }) + flat(rect(42, 120, 40, 5), C.chromeD) + flat(rect(42, 130, 26, 5), C.chromeD), -8, 64, 127);
  s += spk(166, 40, 9) + spk(30, 28, 6);
  return icon(s, 176);
});

add('icon_spentkey', () => {
  let s = keyArt('#B7AFC0', '#8D8499', '');
  s += line([[40, 40], [92, 100]], C.coral, 5);
  return icon(s, 176);
});

add('icon_punchcard', () => {
  let s = shape(rect(30, 40, 124, 104), C.cream, C.creamD, { sw: SWi, dx: 6, dy: 6 });
  s += shape(rect(30, 40, 124, 26), C.coral, C.coralD, { sw: SWi, dx: 0, dy: 3 });
  s += flat(rect(44, 50, 56, 6), C.cream);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const x = 52 + c * 28, y = 90 + r * 28, punched = r * 4 + c < 5;
    s += punched ? `<circle cx="${x}" cy="${y}" r="9" fill="${C.plum}"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="5" fill="#2A1D38"/>` : `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${C.plum}" stroke-width="3" stroke-dasharray="4 3"/>`;
  }
  s += spk(160, 36, 9) + spk(24, 150, 6);
  return icon(s, 176);
});

add('icon_doublebag', () => {
  const bag = (x, y, w, h, fill, sh, fold) => shape([[x + w, y + 4], [x + w + 16, y - 4], [x + w + 16, y + h - 6], [x + w, y + h]], sh, fold, { sw: SWi, dx: 3, dy: 3 }) + S5(rect(x, y, w, h), fill, sh, { dx: 7, dy: 5 }) + line([[x + w * 0.5, y + h], [x + w * 0.5, y + h - 14]], sh, 3, 'opacity="0"') + flat([[x + 6, y + 6], [x + 22, y + 6], [x + 6, y + 34]], C.white, 'opacity=".35"') + line([[x, y + 10], [x + w, y + 10]], sh, 3, 'opacity=".7"');
  let s = bag(36, 34, 76, 112, '#D9A15A', '#A8703A', C.breadD);
  s += S5([[40, 34], [108, 34], [100, 26], [48, 26]], '#8A5A33', null, { sw: 4 }).replace(/<path/, '<path');
  s += bag(68, 56, 80, 112, C.cream, C.creamD, '#CFC3A0');
  s += line([[84, 56], [84, 70]], C.plum, 4, 'opacity="0"');
  s += shape([[68, 56], [148, 56], [164, 48], [84, 48]], '#7A4A1F', null, { sw: 4.5 });
  s += S5([[92, 84], [128, 84], [132, 118], [96, 120]], C.coral, C.coralD, { dx: 4, dy: 3, sw: 4.5 }) + `<circle cx="110" cy="90" r="2.8" fill="${C.cream}" stroke="${C.plum}" stroke-width="1.8"/>`;
  const xr = (x, y, d) => rot(flat(rect(x - 8, y - 2, 16, 4), C.cream), d, x, y);
  s += xr(104, 106, 45) + xr(104, 106, -45) + flat(rect(116, 96, 4.5, 20), C.cream) + flat(rect(123, 96, 4.5, 20), C.cream);
  return icon(s, 174);
});

add('icon_multipack', () => {
  const kraft = '#C98E4B', kd = '#A8703A';
  let s = shape([[24, 124], [48, 106], [168, 106], [144, 124]], '#E3B070', kraft, { sw: SWi, dx: 0, dy: 4 });
  s += shape([[144, 124], [168, 106], [168, 142], [144, 160]], kd, '#7A4A1F', { sw: SWi, dx: 2, dy: 2 });
  const cn = (cx, top, col, sh) => can(cx, top, 40, 52, col, sh, C.cream, { sw: SWi - 1.5 });
  s += cn(78, 54, C.coral, C.coralD) + cn(130, 54, C.teal, C.tealD);
  s += cn(52, 82, C.teal, C.tealD) + cn(104, 82, C.coral, C.coralD);
  s += `<ellipse cx="78" cy="88" rx="38" ry="9" fill="none" stroke="${C.plum}" stroke-width="7" opacity="0"/>`;
  const ring = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${C.plum}" stroke-width="7"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${C.frost}" stroke-width="3"/>`;
  s += ring(78, 88, 36, 8) + ring(116, 88, 36, 8);
  s += S5([[24, 124], [144, 124], [144, 162], [24, 162]], kraft, kd, { dx: 7, dy: 5 });
  s += shape(rect(44, 134, 80, 16), C.cream, C.creamD, { sw: 3.5, dx: 2, dy: 3 }) + flat(rect(50, 139, 30, 5), C.coral) + flat(rect(84, 139, 8, 5), C.teal);
  s += shape(star(162, 52, 24, 17, 12, -90), C.gold, C.goldD, { sw: 4, dx: 3, dy: 3 });
  s += flat(rect(146, 49.5, 14, 5), C.plum) + flat(rect(150.5, 45, 5, 14), C.plum) + flat(rect(166, 42, 5, 22), C.plum) + flat([[166, 42], [160, 48], [166, 49]], C.plum);
  return icon(s, 174);
});

add('proj_pot', () => {
  let s = cloud([[20, 7, 4.2], [27, 8, 3.2], [14, 9, 3]], C.cream);
  s += line([[7, 22], [3, 22], [3, 26], [7, 27]], C.plum, 2.4) + line([[33, 22], [37, 22], [37, 26], [33, 27]], C.plum, 2.4);
  s += shape([[7, 16], [33, 16], [32, 32], [8, 32]], '#4A3560', C.plum, { sw: 2.2, dx: 3, dy: 2 });
  s += shape([[5, 13], [35, 13], [33, 18], [7, 18]], C.chromeD, '#7C8599', { sw: 2.2, dx: 0, dy: 1.5 }) + shape(rect(17, 10, 6, 4), C.gold, null, { sw: 1.6 });
  s += flat([[10, 20], [14, 20], [13, 29]], C.lav, 'opacity=".7"');
  return s;
});

add('fx_boom', () => {
  const sq = (pts) => pts.map(([x, y]) => [x, 65 + (y - 65) * 0.62]);
  let s = `<ellipse cx="100" cy="65" rx="94" ry="57" fill="${C.lav}" fill-opacity=".14" stroke="${C.lav}" stroke-width="5" stroke-opacity=".5"/>`;
  s += shape(sq(star(100, 65, 82, 52, 14, -90)), C.coral, C.coralD, { sw: 2, dx: 3, dy: 3 });
  s += shape(sq(star(100, 65, 64, 40, 13, -80)), C.gold, C.goldD, { sw: 1.6, dx: 3, dy: 3, stroke: C.coralD });
  s += flat(sq(star(100, 65, 42, 26, 11, -70)), C.cream);
  const r = rng(77);
  for (let i = 0; i < 16; i++) { const t = r() * Math.PI * 2, d = 0.9 + r() * 0.14, x = 100 + Math.cos(t) * 94 * d, y = 65 + Math.sin(t) * 55 * d; s += i % 3 ? `<circle cx="${n(x)}" cy="${n(y)}" r="${n(2 + r() * 2)}" fill="${[C.gold, C.coral, C.plumSoft][i % 3]}"/>` : rot(flat(rect(x - 3, y - 2, 6, 4), C.plum), r() * 90, x, y); }
  return s;
});

add('fx_spray', () => {
  const pt = (rr, deg) => [rr * Math.cos((deg * Math.PI) / 180), 80 + rr * Math.sin((deg * Math.PI) / 180)];
  let s = '';
  const bands = 6, R = 214;
  for (let i = 0; i < bands; i++) {
    const r0 = (R * i) / bands, r1 = (R * (i + 1)) / bands, arc0 = [], arc1 = [];
    for (let k = 0; k <= 12; k++) { const a = -35 + (70 * k) / 12; arc1.push(pt(r1, a)); arc0.push(pt(r0, a)); }
    s += `<path d="${D([...arc1, ...arc0.reverse()])}" fill="${i % 2 ? '#CFF3FF' : '#BDEBE4'}" fill-opacity="${n(0.55 * (1 - i / (bands + 0.5)))}"/>`;
  }
  const r = rng(31);
  for (let i = 0; i < 90; i++) { const rr = 10 + Math.pow(r(), 0.8) * 200, a = (r() - 0.5) * 66, [x, y] = pt(rr, a), f = 1 - rr / 230; s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(2 + r() * 3.2)}" fill="${r() > 0.5 ? C.cream : '#7FD6CB'}" fill-opacity="${n(0.4 + 0.6 * f)}"/>`; }
  for (let i = 0; i < 7; i++) { const a = -28 + i * 9.3, pts = []; for (let rr = 14; rr < 150 + (i % 3) * 20; rr += 8) { const [x, y] = pt(rr, a + Math.sin(rr / 14 + i) * 2.2); pts.push([x, y]); } s += line(pts, C.white, 2, `opacity="${0.45}"`); }
  return s;
});

add('fx_gust', () => {
  // wind streaks fanning out of the nozzle, with a few leaves riding along
  const pt = (rr, deg) => [rr * Math.cos((deg * Math.PI) / 180), 80 + rr * Math.sin((deg * Math.PI) / 180)];
  let s = '';
  const r = rng(77);
  for (let i = 0; i < 9; i++) { const a = -26 + i * 6.5, pts = []; for (let rr = 10 + (i % 3) * 14; rr < 120 + r() * 90; rr += 9) pts.push(pt(rr, a + Math.sin(rr / 18 + i) * 3.5)); s += line(pts, i % 2 ? C.white : C.frost, 3.2, `opacity="${n(0.5 + 0.3 * r())}"`); }
  for (let i = 0; i < 6; i++) { const [x, y] = pt(40 + r() * 160, (r() - 0.5) * 48), a = r() * 180; s += rot(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="9" ry="4.5" fill="${[C.green, C.gold, C.coralL][i % 3]}" stroke="${C.plum}" stroke-width="1.6"/>`, a, x, y); }
  return s;
});

add('fx_confetti', () => shape([[2, 4], [12, 1.8], [14, 7], [4, 10.2]], C.coral, C.coralD, { sw: 1.1, dx: 1, dy: 1 }) + flat([[4, 4.6], [10, 3.4], [10, 4.4]], C.coralL));

add('fx_echo', () => {
  const arc = (d) => `<path d="${d}" fill="none" stroke="${C.plum}" stroke-width="11" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${C.gold}" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${C.cream}" stroke-width="2.6" stroke-linecap="round"/>`;
  return arc('M20 8 Q46 32 20 56') + arc('M38 14 Q58 32 38 50') + spk(54, 12, 5).replace(/<path/, '<path');
});


// =====================================================================================
// SKINS (recolors of goblin and cart layers, keys <base>__<skin>)
// =====================================================================================
const GSK = {
  night: { ...K0, skin: '#8E7BC4', skinD: '#6A5899', skinL: '#B5A6E0', apron: '#2E3F6B', apronD: '#1F2B4D', eye: '#FFE9A8' },
  frost: { ...K0, skin: '#A8DDF0', skinD: '#78B6D0', skinL: '#DDF5FF', apron: C.teal, apronD: C.tealD, eye: C.gold },
  gold: { ...K0, skin: '#F5BD45', skinD: '#D08D20', skinL: '#FFE08A', apron: C.coral, apronD: C.coralD, heart: C.cream, heartD: C.creamD },
};
const CSK = {
  coral: { ...K0, cf: C.coral, cfD: C.coralD, cfL: '#FBC3B7', grip: C.cream, gripD: C.creamD, gripL: C.white, hub: C.cream },
  gold: { ...K0, cf: C.gold, cfD: C.goldD, cfL: '#FFE08A', grip: C.plumSoft, gripD: C.plum, gripL: C.lav, hub: C.gold },
};
const gDeco = (key, skin) => {
  const head = key.startsWith('goblin_head');
  if (skin === 'night' && key === 'goblin_head') return line([[37, 47], [51, 50]], C.plumSoft, 2.2, 'opacity=".8"') + line([[56, 45], [68, 47]], C.plumSoft, 2.2, 'opacity=".8"');
  if (skin === 'frost') {
    if (head) return [[84, 46, 1.6], [77, 44, 1.3], [60, 22, 1.4], [44, 20, 1.2], [30, 33, 1.3]].concat(key === 'goblin_head_hurt' ? [] : [[12, 22, 1.5], [18, 30, 1.2], [76, 8, 1.4], [72, 14, 1]]).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".95"/>`).join('') + line([[78, 50], [84, 49]], '#fff', 1.4, 'opacity=".9"');
    if (key === 'goblin_torso') return shape([[9, 11], [46, 9], [48, 19], [10, 21]], '#E8F9FF', '#A9DDF0', { sw: SWs + 0.5, dx: 0, dy: 3 }) + flat([[16, 11.5], [21, 11], [22, 20], [17, 20.5]], C.sky, 'opacity=".8"') + flat([[30, 10.5], [35, 10], [36, 19.5], [31, 20]], C.sky, 'opacity=".8"') + shape([[34, 20], [44, 20], [42, 34], [33, 32]], '#E8F9FF', '#A9DDF0', { sw: SWs, dx: 2, dy: 2 });
  }
  if (skin === 'gold') {
    if (head) return flat([[26, 29], [38, 20], [52, 17], [57, 20], [44, 24], [32, 33]], '#FFF2D5', 'opacity=".9"');
    if (key === 'goblin_torso') return shape(star(24, 23, 5.6, 2.4, 5), '#FFE08A', null, { sw: 1.5 }) + flat([[14, 8], [20, 7], [14, 33]], '#FFF2D5', 'opacity=".6"');
    if (key === 'goblin_arm') return flat([[6, 9], [24, 8.5], [24, 10.5], [6, 11]], '#FFF2D5', 'opacity=".7"');
    return flat([[28, 8], [31, 8], [24, 24]], '#FFF2D5', 'opacity=".5"');
  }
  return '';
};
const cDeco = (key, skin) => {
  if (key !== 'cart_front') return '';
  if (skin === 'coral') return `<g transform="translate(3 2)">` + line([[56, 15], [58, 26]], C.plum, 1.2) + rot(shape(rect(50, 26, 18, 12), C.cream, C.creamD, { sw: 1.8, dx: 1.5, dy: 2 }) + `<circle cx="55" cy="32" r="2.2" fill="${C.coral}"/>` + flat(rect(59, 30, 6, 1.8), C.chromeD) + flat(rect(59, 34, 5, 1.8), C.chromeD), -6, 59, 32) + `</g>`;
  return `<g transform="translate(3 2)">` + flat(star(42, 30, 4.5, 1.2, 4), '#fff', 'opacity=".95"') + flat(star(96, 36, 3.6, 1, 4), '#fff', 'opacity=".95"') + flat(star(66, 44, 3, 0.9, 4), '#fff', 'opacity=".9"') + `</g>`;
};
for (const [skin, pal] of Object.entries(GSK)) for (const key of ['goblin_legs_a', 'goblin_legs_b', 'goblin_torso', 'goblin_head', 'goblin_head_hurt', 'goblin_head_shove', 'goblin_arm'])
  add(`${key}__${skin}`, () => { const o = ASSETS[key]; K = pal; try { return o() + gDeco(key, skin); } finally { K = K0; } });
for (const [skin, pal] of Object.entries(CSK)) for (const key of ['cart_back', 'cart_front', 'cart_wheel'])
  add(`${key}__${skin}`, () => { const o = ASSETS[key]; K = pal; try { return o() + cDeco(key, skin); } finally { K = K0; } });

// =====================================================================================
// WRITE
// =====================================================================================
fs.mkdirSync(OUT, { recursive: true });
const missing = [];
for (const { key, w, h } of MANIFEST) {
  const fn = ASSETS[key];
  if (!fn) { missing.push(key); continue; }
  uid = 0;
  const body = fn();
  if (/<text|href=|filter=/.test(body)) throw new Error(`forbidden markup in ${key}`);
  fs.writeFileSync(path.join(OUT, `${key}.svg`), doc(w, h, body));
}
const extra = Object.keys(ASSETS).filter((k) => !MANIFEST.some((m) => m.key === k));
if (missing.length || extra.length) console.warn('MISSING:', missing, 'EXTRA:', extra);

const cards = MANIFEST.map(({ key, w, h }) => `<figure data-k="${key}" data-w="${w}" data-h="${h}"><img src="${key}.svg" width="${w}" height="${h}" alt="${key}"><figcaption>${key} ${w}x${h}</figcaption></figure>`).join('\n');
fs.writeFileSync(path.join(OUT, 'contact-sheet.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Goblin Grocery contact sheet</title>
<style>body{margin:0;padding:16px;font:11px/1.2 ui-monospace,Menlo,monospace;color:#30203F;background:${C.mint};
background-image:conic-gradient(#d5ebdd 25%,transparent 0 50%,#d5ebdd 0 75%,transparent 0);background-size:48px 48px}
main{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px}
figcaption{background:#FFF2D5;padding:1px 4px;border-radius:2px}img{display:block;outline:1px dashed rgba(48,32,63,.18)}</style></head>
<body><main>${cards}</main><script>
if(location.hash==='#zoom'){for(const f of document.querySelectorAll('figure')){const k=f.dataset.k,i=f.querySelector('img'),w=+f.dataset.w,h=+f.dataset.h;
let s=1;if(/^(enemy_|boss_)/.test(k))s=.5;else if(k.startsWith('icon_'))s=64/192;else if(/^(shelf|freezer|fx_frost|fx_pulse)/.test(k))s=.5;if(s!==1){i.width=w*s;i.height=h*s}}}
</script></body></html>
`);
console.log(`wrote ${MANIFEST.length - missing.length} svgs + contact-sheet.html`);
