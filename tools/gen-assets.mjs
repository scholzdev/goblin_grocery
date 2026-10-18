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

// ---------- faces for cursed groceries ----------
const eye = (x, y, r = 5, px = 1, col = C.cream) =>
  `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n(r * 0.85)}" fill="${col}" stroke="${C.plum}" stroke-width="2"/><circle cx="${x + px}" cy="${y + 0.5}" r="${n(r * 0.45)}" fill="${C.plum}"/>`;
const brow = (x1, y1, x2, y2, w = 3.5) => line([[x1, y1], [x2, y2]], C.plum, w).replace('round"', 'butt"');
function mouth(cx, cy, w, h, teeth = 3) {
  let s = shape([[cx - w / 2, cy], [cx + w / 2, cy - 1], [cx + w * 0.4, cy + h * 0.7], [cx, cy + h], [cx - w * 0.42, cy + h * 0.65]], C.plum, null, { sw: 1.5 });
  const tw = w / teeth;
  for (let i = 0; i < teeth; i++) {
    const x = cx - w / 2 + (i + 0.5) * tw;
    s += flat([[x - tw * 0.4, cy + 0.5], [x + tw * 0.4, cy], [x + (i % 2 ? 0.8 : -0.8), cy + h * 0.5]], C.cream);
  }
  s += flat([[cx - w * 0.14, cy + h * 0.98], [cx + w * 0.14, cy + h * 0.98], [cx, cy + h * 0.58]], C.cream);
  return s;
}
// angry face: eyes + slanted brows + toothy mouth. s = scale, anger = brow tilt
function face(cx, cy, s = 1, o = {}) {
  const g = (o.gap ?? 7) * s, t = (o.tilt ?? 5) * s, ec = o.eyeCol ?? C.cream;
  return eye(cx - g, cy, 4.6 * s, 1.2 * s, ec) + eye(cx + g, cy, 4.6 * s, -1.2 * s, ec) +
    brow(cx - g - 6 * s, cy - 5.5 * s - t * 0.6, cx - g + 4 * s, cy - 5 * s + t * 0.9) +
    brow(cx + g + 6 * s, cy - 5.5 * s - t * 0.6, cx + g - 4 * s, cy - 5 * s + t * 0.9) +
    mouth(cx, cy + (o.my ?? 8) * s, (o.mw ?? 16) * s, (o.mh ?? 9) * s, o.teeth ?? 4);
}
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
  const a = f === 'a', sq = a ? [1.02, 0.97] : [0.98, 1.03], gy = 91;
  const legs = a ? stick([[24, 76], [18, 84], [14, 90]], 3.5, 6) + stick([[43, 76], [47, 83], [53, 90]], 3.5, 6)
    : stick([[24, 76], [27, 84], [26, 90]], 3.5, 6) + stick([[43, 76], [40, 82], [44, 89]], 3.5, 6);
  const arms = a ? stick([[12, 50], [7, 55], [5, 47]], 3.5) + stick([[57, 48], [63, 42], [67, 48]], 3.5)
    : stick([[12, 50], [7, 44], [5, 52]], 3.5) + stick([[57, 48], [63, 52], [67, 44]], 3.5);
  let b = '';
  b += shape([[16, 20], [44, 20], [48, 34], [12, 34]], C.cream, C.creamD, { dx: 2, dy: 3 }); // sloped roof
  b += shape([[44, 20], [54, 17], [58, 30], [48, 34]], C.creamD, C.lav, { dx: 1, dy: 3 });
  b += shape([[17, 11], [42, 10], [43, 21], [16, 21]], C.blue, C.blueD, { dx: 2, dy: 2 }); // top fin
  b += line([[22, 12], [22, 20]], C.plum, 1.6) + line([[28, 12], [28, 20]], C.plum, 1.6) + line([[34, 12], [34, 20]], C.plum, 1.6);
  b += shape([[48, 34], [58, 30], [58, 74], [48, 79]], C.creamD, C.lav, { dx: 2, dy: 0 });
  b += shape([[12, 34], [48, 34], [48, 79], [12, 77]], C.cream, C.creamD, { dx: 4, dy: 3 });
  b += shape([[12, 66], [48, 67], [48, 79], [12, 77]], C.blue, C.blueD, { dx: 4, dy: 2 });
  b += flat([[22, 68], [36, 69], [30, 77]], C.cream) + flat([[40, 69], [46, 69], [46, 75]], C.cream);
  b += flat([[16, 38], [22, 37], [16, 46]], C.blue, 'opacity=".5"');
  b += face(30, 49, 1, { mw: 18, mh: 10, my: 8 });
  return `${legs}${squash(36, gy, sq[0], sq[1], b)}${arms}`;
}
add('enemy_milk_a', () => milk('a'));
add('enemy_milk_b', () => milk('b'));

function banana(f) {
  const tell = f === 'tell', a = f === 'a';
  let body = '';
  const flapL = tell ? [[28, 56], [14, 62], [8, 72], [24, 66]] : a ? [[28, 50], [13, 40], [8, 24], [22, 38]] : [[28, 52], [12, 46], [4, 34], [20, 44]];
  const flapR = tell ? [[54, 54], [66, 62], [72, 74], [58, 64]] : a ? [[55, 48], [68, 36], [71, 20], [60, 36]] : [[55, 50], [70, 44], [76, 32], [62, 42]];
  body += shape(flapL, C.banana, C.bananaD, { dx: 2, dy: 2 }) + flat([flapL[0], flapL[1], flapL[3]].map(([x, y], i) => [x + (i ? 1.5 : 2), y + 1.5]), C.bananaL);
  body += shape(flapR, C.banana, C.bananaD, { dx: 2, dy: 2 }) + flat([flapR[0], flapR[1], flapR[3]].map(([x, y], i) => [x - (i ? 1.5 : 2), y + 1.5]), C.bananaL);
  body += shape([[28, 24], [42, 14], [55, 30], [59, 52], [51, 72], [36, 77], [30, 62], [26, 42]], C.banana, C.bananaD, { dx: 5, dy: 4 });
  body += flat([[30, 28], [40, 19], [43, 21], [34, 38]], C.bananaL);
  body += shape([[39, 15], [46, 15], [46, 8], [41, 7]], C.breadD, null, { sw: SWs }); // stem
  body += flat([[31, 60], [34, 57], [35, 62]], C.breadD) + flat([[52, 38], [55, 41], [51, 43]], C.breadD);
  body += face(42, 46, 0.95, { eyeCol: tell ? C.coral : C.cream, mw: 15, mh: 9, my: 8, teeth: 4 });
  if (tell) {
    const bent = rot(squash(40, 92, 1.06, 0.82, body), -16, 40, 92);
    const legs = stick([[36, 80], [26, 86], [18, 94]], 3.5, 6) + stick([[47, 80], [57, 86], [64, 94]], 3.5, 6);
    return `<g transform="translate(40 95) scale(.95) translate(-40 -95)">` + legs + bent + spark(64, 14, 11) + line([[50, 4], [48, 10]], C.coral, 2.5) + line([[75, 6], [72, 12]], C.coral, 2.5) + '</g>';
  }
  const legs = a ? stick([[36, 77], [30, 87], [25, 94]], 3.2, 6) + stick([[46, 75], [53, 85], [58, 94]], 3.2, 6)
    : stick([[36, 77], [38, 86], [36, 94]], 3.2, 6) + stick([[46, 75], [48, 84], [54, 94]], 3.2, 6);
  return legs + squash(40, 94, a ? 1 : 0.97, a ? 1 : 1.03, body);
}
add('enemy_banana_a', () => banana('a'));
add('enemy_banana_b', () => banana('b'));
add('enemy_banana_tell', () => banana('tell'));

function sodaCan(cx, top, h, face_, f) {
  const w = 31;
  let s = can(cx, top, w, h, C.soda, C.sodaD, C.cream, { sw: SW });
  if (face_) s += face(cx, top + 17, 0.85, { gap: 6.5, mw: 14, mh: 7, my: 8, teeth: 3, eyeCol: f === 'tell' ? C.coralL : C.cream });
  return s;
}
function soda(f) {
  const tell = f === 'tell', a = f !== 'b', dy = a ? 0 : -2;
  const L = (...p) => stick(p, 3.2);
  let legs = a ? L([24, 68], [20, 74], [17, 80]) + L([36, 69], [38, 75], [41, 80]) + L([55, 72], [50, 76], [48, 81]) + L([66, 72], [69, 77], [72, 81]) + L([76, 68], [74, 74], [70, 80]) + L([89, 66], [93, 73], [96, 80])
    : L([24, 68], [27, 75], [26, 80]) + L([36, 69], [33, 74], [34, 80]) + L([55, 72], [58, 77], [60, 81]) + L([66, 72], [62, 77], [64, 81]) + L([76, 68], [80, 75], [82, 80]) + L([89, 66], [86, 73], [88, 80]);
  let b = sodaCan(22, 12, 34, false) + sodaCan(55, 10, 34, false) + sodaCan(88, 12, 34, false);
  b += sodaCan(22, 30, 38, true) + sodaCan(88, 30, 38, true) + sodaCan(55, 36, 38, true);
  // six-pack plastic: one wavy strip per row, dipping around each can and rising between them
  const strip = (ys, r = 15.5) => {
    const cx = [22, 55, 88];
    let d = `M${cx[0] - r - 1} ${ys[0] - 2}`;
    cx.forEach((x, i) => { d += ` A${r} 4 0 0 0 ${x + r} ${ys[i]}`; if (i < 2) d += ` L${cx[i + 1] - r} ${ys[i + 1]}`; });
    d += ` L${cx[2] + r + 1} ${ys[2] - 2}`;
    return `<path d="${d}" fill="none" stroke="${C.plum}" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${C.frost}" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`;
  };
  b += strip([21, 19, 21]) + strip([39, 45, 39]);
  if (tell) { // shaken up: fizz spurting from the tabs
    for (const [x, y, r] of [[22, 22, 7], [14, 12, 5], [88, 22, 7], [96, 11, 5], [55, 26, 6]]) b += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.frost}" stroke="${C.plum}" stroke-width="2" opacity=".95"/>`;
    b += spark(55, 8, 9) + line([[4, 40], [10, 48]], C.coral, 2.5) + line([[106, 40], [100, 48]], C.coral, 2.5);
  }
  return squash(55, 80, tell ? 0.96 : a ? 1 : 1.03, tell ? 1.05 : a ? 1 : 0.97, legs + `<g transform="translate(0 ${dy})">${b}</g>`);
}
add('enemy_soda_a', () => soda('a'));
add('enemy_soda_b', () => soda('b'));
add('enemy_soda_tell', () => soda('tell'));

function spitter(f) {
  const tell = f === 'tell', a = f === 'a';
  let b = '';
  // handle loop (left side)
  b += tube([[18, 40], [11, 44], [10, 60], [14, 70], [20, 68]], 4.5, C.det, 2.2);
  const body = tell
    ? [[18, 50], [24, 36], [34, 29], [36, 26], [50, 26], [54, 32], [62, 38], [66, 52], [60, 64], [66, 78], [58, 85], [24, 85], [17, 77], [24, 62]]
    : [[14, 52], [18, 38], [30, 30], [36, 26], [52, 26], [58, 32], [68, 40], [70, 56], [68, 78], [58, 84], [24, 84], [14, 76]];
  b += shape(body, C.det, C.detD, { dx: 5, dy: 4 });
  b += flat([[20, 42], [30, 34], [34, 36], [24, 48]], '#7FA4F0', 'opacity=".85"');
  // label
  b += shape([[17, 64], [64, 62], [67, 79], [20, 81]], C.cream, C.creamD, { dx: 3, dy: 3, sw: SWs + 0.5 });
  b += shape('M43 66 L38 73 Q37 78 43 78 Q49 78 48 73 Z', C.coral, C.coralD, { sw: SWs, dx: 1, dy: 1.5 }) + flat([[25, 68], [33, 68], [30, 70]], C.det);
  b += face(40, 48, 0.9, { mw: 14, mh: 8, my: 7, teeth: 3, eyeCol: tell ? '#FFD6C8' : C.cream });
  // cap
  if (tell) {
    b += shape([[36, 26], [52, 26], [52, 22], [36, 22]], C.coralD, null, { sw: SWs });
    b += rot(shape([[34, 22], [48, 22], [48, 16], [34, 16]], C.coral, C.coralD, { dx: 2, dy: 2 }), -62, 34, 22);
    b += shape([[36, 26], [54, 26], [62, 21], [62, 27], [54, 30], [36, 30]], C.coral, C.coralD, { sw: SWs, dx: 1, dy: 1.5 });
    b += `<circle cx="70" cy="14" r="9" fill="${C.frost}" stroke="${C.plum}" stroke-width="2" opacity=".95"/><circle cx="66.5" cy="10.5" r="2.8" fill="${C.white}"/><path d="M73 18 A7 7 0 0 0 76 12" fill="none" stroke="${C.sky}" stroke-width="2"/>`;
    b += line([[58, 12], [53, 8]], C.coral, 2.5) + line([[73, 28], [79, 32]], C.coral, 2.5);
  } else {
    b += shape([[34, 16], [54, 16], [56, 27], [32, 27]], C.coral, C.coralD, { dx: 3, dy: 3 });
    b += shape([[48, 11], [62, 11], [64, 17], [48, 17]], C.coral, C.coralD, { dx: 2, dy: 2, sw: SWs + 0.5 });
    b += line([[38, 18], [38, 26]], C.plum, 1.4) + line([[44, 18], [44, 26]], C.plum, 1.4);
  }
  const L = (...p) => stick(p, 3.4, 6);
  let legs = tell ? L([30, 84], [20, 88], [14, 92]) + L([52, 84], [62, 88], [70, 92])
    : a ? L([30, 84], [24, 88], [20, 92]) + L([52, 84], [56, 88], [60, 92]) : L([30, 84], [33, 88], [32, 92]) + L([52, 84], [49, 88], [52, 92]);
  let arms = tell ? stick([[14, 56], [8, 50], [10, 42]], 3.4) + stick([[68, 54], [76, 50], [74, 42]], 3.4)
    : a ? stick([[68, 54], [76, 49], [79, 55]], 3.4) + stick([[15, 54], [9, 60], [11, 66]], 3.4) : stick([[68, 54], [76, 58], [79, 51]], 3.4);
  return legs + squash(42, 91, tell ? 0.96 : a ? 1 : 1.03, tell ? 1.03 : a ? 1 : 0.97, b) + arms;
}
add('enemy_spitter_a', () => spitter('a'));
add('enemy_spitter_b', () => spitter('b'));
add('enemy_spitter_tell', () => spitter('tell'));

function baguette(f) {
  const tell = f === 'tell', a = f === 'a';
  let b = shape([[25, 12], [40, 6], [52, 16], [55, 42], [53, 82], [48, 102], [36, 106], [25, 100], [21, 72], [21, 32]], C.bread, C.breadD, { dx: 5, dy: 3 });
  b += flat([[25, 16], [36, 9], [40, 11], [30, 30], [26, 60]], C.breadL, 'opacity=".9"');
  // diagonal score marks
  for (const [x, y] of [[26, 62], [27, 76], [28, 90]]) b += shape([[x, y], [x + 22, y - 8], [x + 24, y - 3], [x + 2, y + 6]], C.cream, C.creamD, { sw: SWs, dx: 1, dy: 2 });
  b += shape([[25, 22], [41, 15], [43, 19], [27, 26]], C.cream, C.creamD, { sw: SWs, dx: 1, dy: 1.5 });
  b += face(38, 40, 0.92, { gap: 6.5, mw: 14, mh: 9, my: 8, teeth: 3, eyeCol: tell ? '#FFD0C0' : C.cream });
  const L = (...p) => stick(p, 3.4, 6);
  if (tell) {
    const bat = rot(squash(36, 108, 1, 0.93, b), -24, 36, 108);
    return L([30, 106], [20, 109], [13, 114]) + L([44, 106], [54, 110], [60, 114]) + `<g transform="translate(16 2)">${bat}</g>` +
      stick([[59, 54], [65, 60], [61, 70]], 3.4) + stick([[52, 60], [57, 66], [55, 74]], 3.4) + line([[64, 30], [67, 24]], C.coral, 2.5) + line([[60, 22], [62, 15]], C.coral, 2.5);
  }
  const sway = a ? 2 : -2;
  const legs = a ? L([30, 104], [24, 110], [19, 114]) + L([43, 104], [46, 110], [50, 114]) : L([30, 104], [33, 109], [31, 114]) + L([43, 104], [40, 108], [43, 114]);
  const arms = a ? stick([[22, 54], [14, 60], [11, 52]], 3.4) + stick([[53, 52], [62, 48], [64, 56]], 3.4) : stick([[22, 54], [13, 50], [11, 58]], 3.4) + stick([[53, 52], [62, 58], [65, 50]], 3.4);
  return legs + rot(squash(36, 108, 1, a ? 1 : 0.98, b), sway, 36, 108) + arms;
}
add('enemy_baguette_a', () => baguette('a'));
add('enemy_baguette_b', () => baguette('b'));
add('enemy_baguette_tell', () => baguette('tell'));


// ---------- egg carton (exploder) ----------
function egg(f) {
  const tell = f === 'tell', a = f === 'a';
  const legs = tell ? stick([[28, 70], [22, 78], [18, 84]], 3.5, 5) + stick([[46, 70], [50, 78], [54, 84]], 3.5, 5)
    : a ? stick([[28, 70], [22, 78], [18, 84]], 3.5, 5) + stick([[46, 70], [48, 78], [54, 84]], 3.5, 5)
    : stick([[28, 70], [29, 78], [27, 84]], 3.5, 5) + stick([[46, 70], [43, 77], [47, 84]], 3.5, 5);
  let b = '';
  b += shape([[12, 40], [62, 40], [66, 72], [8, 72]], tell ? C.coralL : C.creamD, tell ? C.coral : C.lav, { dx: 3, dy: 3 }); // carton base
  b += ell(24, 36, 8, 11, C.white, C.creamD, { dx: 2, dy: 2, sw: SWs }) + ell(38, 33, 8, 11, C.white, C.creamD, { dx: 2, dy: 2, sw: SWs }) + ell(52, 36, 8, 11, C.white, C.creamD, { dx: 2, dy: 2, sw: SWs });
  b += shape([[8, 30], [66, 28], [68, 42], [6, 44]], tell ? C.coral : C.cream, tell ? C.coralD : C.creamD, { dx: 3, dy: 3 }); // lid
  b += line([[16, 36], [58, 35]], C.plum, 1.4);
  b += face(37, 55, 0.9, { mw: 14, mh: 8, my: 6, teeth: 3, eyeCol: tell ? C.coral : C.cream });
  const g = tell ? 1.08 : 1;
  return legs + squash(37, 80, tell ? 1.1 : a ? 1.02 : 0.98, tell ? 0.92 : a ? 0.98 : 1.02, b) + (tell ? spark(62, 18, 10) + spark(12, 20, 7) : '');
}
add('enemy_egg_a', () => egg('a'));
add('enemy_egg_b', () => egg('b'));
add('enemy_egg_tell', () => egg('tell'));

// ---------- watermelon (splitter) + slice ----------
function melon(f) {
  const a = f === 'a';
  const legs = a ? stick([[28, 78], [22, 87], [18, 94]], 3.8, 6) + stick([[52, 78], [56, 86], [62, 94]], 3.8, 6)
    : stick([[28, 78], [29, 87], [27, 94]], 3.8, 6) + stick([[52, 78], [49, 86], [53, 94]], 3.8, 6);
  let b = '';
  b += ell(40, 48, 31, 30, C.green, C.greenD, { dx: 4, dy: 5 });
  for (const x of [22, 32, 42, 52, 60]) b += line([[x, 22 + Math.abs(x - 41) * 0.3], [x - 2, 48], [x + 1, 72 - Math.abs(x - 41) * 0.3]], C.greenD, 3.2);
  b += flat([[18, 36], [26, 26], [30, 28], [22, 42]], C.greenL, 'opacity=".7"');
  b += face(40, 50, 1.15, { mw: 20, mh: 11, my: 9, teeth: 4 });
  return legs + squash(40, 92, a ? 1.02 : 0.98, a ? 0.98 : 1.03, b);
}
// ---------- frozen turkey (tank) ----------
function turkey(f) {
  const tell = f === 'tell', a = f !== 'b';
  const legs = a ? stick([[44, 70], [38, 80], [34, 90]], 4.2, 6) + stick([[76, 70], [80, 80], [86, 90]], 4.2, 6)
    : stick([[44, 70], [45, 80], [43, 90]], 4.2, 6) + stick([[76, 70], [74, 80], [77, 90]], 4.2, 6);
  let b = '';
  // drumsticks poking up at the sides, wings, then the big frosty body
  b += shape([[14, 40], [26, 30], [34, 42], [24, 54]], C.coralL, C.coral, { dx: 2, dy: 3 }) + ell(14, 40, 6, 6, C.cream, C.creamD, { sw: SWs });
  b += shape([[106, 40], [94, 30], [86, 42], [96, 54]], C.coralL, C.coral, { dx: 2, dy: 3 }) + ell(106, 40, 6, 6, C.cream, C.creamD, { sw: SWs });
  b += ell(60, 50, 42, 30, C.frost, C.frostD, { dx: 5, dy: 6 });
  b += flat([[28, 34], [40, 24], [46, 27], [34, 42]], C.white, 'opacity=".85"');
  b += snowflake(90, 62, 7, C.white, 2) + snowflake(30, 66, 5, C.white, 1.8);
  b += face(60, 48, 1.3, { mw: tell ? 26 : 22, mh: tell ? 15 : 12, my: 9, teeth: 4, eyeCol: tell ? C.coralL : C.cream });
  // icicles hanging from the belly + frost cap
  for (const x of [38, 52, 68, 82]) b += shape([[x - 4, 76], [x + 4, 76], [x + 0.5, 86 + (x % 3) * 2]], C.frost, C.frostD, { sw: SWs, dx: 1, dy: 1 });
  b += shape([[40, 22], [52, 16], [64, 20], [76, 16], [84, 24], [72, 28], [50, 28]], C.white, C.frostD, { sw: SWs, dx: 2, dy: 2 });
  if (tell) b += spark(14, 18, 10, C.sky) + spark(106, 18, 10, C.sky) + snowflake(60, 8, 6, C.sky, 2);
  return legs + squash(60, 90, tell ? 0.96 : a ? 1.02 : 0.98, tell ? 1.05 : a ? 0.98 : 1.03, b);
}
add('enemy_turkey_a', () => turkey('a'));
add('enemy_turkey_b', () => turkey('b'));
add('enemy_turkey_tell', () => turkey('tell'));

add('enemy_melon_a', () => melon('a'));
add('enemy_melon_b', () => melon('b'));

function slice(f) {
  const a = f === 'a';
  const legs = a ? stick([[30, 52], [26, 58], [23, 62]], 3.2, 4) + stick([[44, 52], [48, 57], [52, 62]], 3.2, 4)
    : stick([[30, 52], [31, 58], [29, 62]], 3.2, 4) + stick([[44, 52], [42, 57], [46, 62]], 3.2, 4);
  let b = '';
  b += shape('M10 22 A28 28 0 0 0 64 22 Z', C.coral, C.coralD, { dx: 2, dy: 3 });
  b += flat('M13 22 A25 25 0 0 0 61 22 Z', C.coral);
  b += shape('M10 22 L64 22 L64 27 L10 27 Z', C.green, C.greenD, { dx: 0, dy: 2, sw: SWs });
  b += `<circle cx="26" cy="34" r="1.8" fill="${C.plum}"/><circle cx="48" cy="34" r="1.8" fill="${C.plum}"/>`;
  b += face(37, 38, 0.6, { mw: 9, mh: 5, my: 5, teeth: 2 });
  return legs + squash(37, 62, a ? 1.03 : 0.97, a ? 0.97 : 1.03, b);
}
add('enemy_slice_a', () => slice('a'));
add('enemy_slice_b', () => slice('b'));

// ---------- canned beans (armored) ----------
function beans(f) {
  const a = f === 'a', gy = 91;
  const legs = a ? stick([[30, 76], [24, 84], [20, 90]], 3.5, 6) + stick([[50, 76], [54, 83], [60, 90]], 3.5, 6)
    : stick([[30, 76], [32, 84], [31, 90]], 3.5, 6) + stick([[50, 76], [47, 82], [51, 89]], 3.5, 6);
  const arms = a ? stick([[18, 48], [11, 54], [9, 46]], 3.5) + stick([[62, 48], [69, 42], [71, 48]], 3.5)
    : stick([[18, 48], [11, 42], [9, 50]], 3.5) + stick([[62, 48], [69, 52], [71, 44]], 3.5);
  let b = '';
  b += shape([[18, 24], [62, 24], [62, 78], [18, 78]], C.chrome, C.chromeD, { dx: 5, dy: 0 }); // tin
  b += flat([[22, 28], [27, 28], [27, 74], [22, 74]], C.chromeL, 'opacity=".7"');
  b += shape([[18, 40], [62, 40], [62, 68], [18, 68]], C.coral, C.coralD, { dx: 4, dy: 3 }); // label
  b += flat([[22, 44], [34, 44], [28, 50]], C.coralL, 'opacity=".6"');
  b += shape(ellPath(40, 24, 22, 6), C.chromeL, C.chromeD, { dx: 2, dy: 1, sw: SWs }); // lid ring
  b += `<ellipse cx="40" cy="24" rx="14" ry="3.4" fill="none" stroke="${C.chromeD}" stroke-width="1.4"/>`;
  b += shape([[16, 74], [64, 74], [64, 80], [16, 80]], C.chromeD, null, { sw: SWs });
  b += ell(26, 63, 3, 2, C.cream, null, { sw: 1.2 }) + ell(54, 63, 3, 2, C.cream, null, { sw: 1.2 });
  b += shape([[50, 71], [56, 66], [58, 71]], C.chromeD, null, { sw: 1.4 }) + line([[17, 55], [22, 52], [20, 58]], C.plum, 1.2); // dents
  b += face(40, 50, 0.95, { mw: 16, mh: 9, my: 7, eyeCol: C.cream });
  return `${legs}${squash(40, gy, a ? 1.02 : 0.98, a ? 0.98 : 1.02, b)}${arms}`;
}
add('enemy_beans_a', () => beans('a'));
add('enemy_beans_b', () => beans('b'));

// ---------- cereal box (shield) ----------
function cereal(f) {
  const a = f === 'a', gy = 93;
  const legs = a ? stick([[30, 82], [25, 88], [21, 93]], 3.5, 6) + stick([[50, 82], [54, 88], [58, 93]], 3.5, 6)
    : stick([[30, 82], [31, 88], [30, 93]], 3.5, 6) + stick([[50, 82], [48, 87], [52, 92]], 3.5, 6);
  const arms = a ? stick([[12, 56], [6, 62], [5, 54]], 3.5) + stick([[68, 56], [74, 50], [76, 56]], 3.5)
    : stick([[12, 56], [6, 50], [5, 58]], 3.5) + stick([[68, 56], [74, 60], [76, 52]], 3.5);
  let b = '';
  b += shape([[62, 18], [72, 14], [72, 78], [62, 82]], C.goldD, C.breadD, { dx: 2, dy: 0 }); // side
  b += shape([[12, 18], [62, 18], [62, 82], [12, 82]], C.gold, C.goldD, { dx: 4, dy: 3 }); // front
  b += shape([[12, 8], [62, 8], [72, 14], [62, 18], [12, 18]], C.cream, C.creamD, { dx: 2, dy: 3 }); // top flap
  b += shape([[12, 66], [62, 66], [62, 82], [12, 82]], C.coral, C.coralD, { dx: 4, dy: 2 }); // base stripe
  b += shape(star(37, 30, 17, 11, 9, -90), C.cream, C.creamD, { dx: 2, dy: 2, sw: SWs }); // flakes splash
  b += ell(24, 74, 3.4, 2.4, C.cream, null, { sw: 1.2 }) + ell(36, 76, 3.4, 2.4, C.cream, null, { sw: 1.2 }) + ell(49, 74, 3.4, 2.4, C.cream, null, { sw: 1.2 });
  b += face(37, 49, 1, { mw: 18, mh: 10, my: 7, teeth: 4 });
  return `${legs}${squash(40, gy, a ? 1.01 : 0.99, a ? 0.99 : 1.01, b)}${arms}`;
}
add('enemy_cereal_a', () => cereal('a'));
add('enemy_cereal_b', () => cereal('b'));

// ---------- honey jar (healer) ----------
function honey(f) {
  const a = f === 'a', gy = 91;
  const legs = a ? stick([[30, 78], [26, 85], [22, 90]], 3.5, 6) + stick([[44, 78], [48, 84], [53, 90]], 3.5, 6)
    : stick([[30, 78], [32, 85], [31, 90]], 3.5, 6) + stick([[44, 78], [42, 83], [46, 89]], 3.5, 6);
  const arms = a ? stick([[14, 54], [8, 60], [6, 52]], 3.5) + stick([[60, 54], [66, 48], [68, 54]], 3.5)
    : stick([[14, 54], [8, 48], [6, 56]], 3.5) + stick([[60, 54], [66, 58], [68, 50]], 3.5);
  let b = '';
  b += shape([[16, 30], [58, 30], [64, 46], [64, 74], [58, 80], [16, 80], [10, 74], [10, 46]], C.mintL, C.mintD, { dx: 4, dy: 3 }); // glass
  b += shape([[12, 40], [62, 40], [62, 74], [57, 78], [17, 78], [12, 74]], C.gold, C.goldD, { dx: 4, dy: 3 }); // honey
  b += flat([[15, 44], [21, 44], [21, 70], [15, 66]], C.cream, 'opacity=".5"');
  b += shape([[20, 40], [26, 40], [26, 52], [23, 55], [20, 52]], C.gold, null, { sw: SWs }); // drip
  b += shape([[14, 22], [60, 22], [60, 32], [14, 32]], C.coral, C.coralD, { dx: 3, dy: 3 }); // lid
  b += line([[22, 24], [22, 30]], C.coralD, 1.6) + line([[30, 24], [30, 30]], C.coralD, 1.6) + line([[38, 24], [38, 30]], C.coralD, 1.6) + line([[46, 24], [46, 30]], C.coralD, 1.6);
  b += shape([[24, 10], [50, 10], [50, 22], [24, 22]], C.cream, C.creamD, { dx: 2, dy: 2, sw: SWs }) + `<path d="M31 17q6-6 12 0q-6 6-12 0z" fill="${C.gold}" stroke="${C.plum}" stroke-width="1.4"/>`; // honey label tag
  b += face(37, 56, 0.95, { mw: 16, mh: 9, my: 7 });
  return `${legs}${squash(37, gy, a ? 1.02 : 0.98, a ? 0.98 : 1.02, b)}${arms}${a ? spark(66, 20, 7, C.gold) : spark(8, 22, 6, C.gold)}`;
}
add('enemy_honey_a', () => honey('a'));
add('enemy_honey_b', () => honey('b'));

// ---------- hand sanitizer / spray bottle (aura cleanser) ----------
function sanitizer(f) {
  const a = f === 'a', gy = 91;
  const legs = a ? stick([[30, 78], [24, 85], [20, 90]], 3.5, 6) + stick([[46, 78], [50, 84], [55, 90]], 3.5, 6)
    : stick([[30, 78], [32, 85], [31, 90]], 3.5, 6) + stick([[46, 78], [44, 83], [48, 89]], 3.5, 6);
  const arms = a ? stick([[14, 56], [8, 62], [6, 54]], 3.5) + stick([[62, 56], [68, 50], [70, 56]], 3.5)
    : stick([[14, 56], [8, 50], [6, 58]], 3.5) + stick([[62, 56], [68, 60], [70, 52]], 3.5);
  const BL = '#7CC4E8', BLD = '#4F9CC4';
  let b = '';
  b += shape([[16, 36], [60, 36], [66, 46], [66, 76], [60, 80], [16, 80], [10, 76], [10, 46]], BL, BLD, { dx: 4, dy: 3 }); // bottle
  b += flat([[14, 46], [20, 46], [20, 72], [14, 68]], C.white, 'opacity=".45"'); // glass shine
  b += shape([[16, 52], [60, 52], [60, 72], [16, 72]], C.cream, C.creamD, { dx: 3, dy: 2, sw: SWs }); // label
  b += shape([[28, 24], [48, 24], [50, 36], [26, 36]], C.white, C.chromeD, { dx: 2, dy: 3 }); // collar
  b += shape([[22, 8], [58, 8], [58, 24], [30, 24], [22, 20]], C.chromeL, C.chromeD, { dx: 3, dy: 3 }); // sprayer head
  b += shape([[12, 12], [22, 10], [22, 18], [12, 18]], C.chrome, C.chromeD, { dx: 2, dy: 2, sw: SWs }); // nozzle
  b += shape([[44, 24], [58, 24], [60, 36], [52, 38], [46, 30]], C.coral, C.coralD, { dx: 2, dy: 2, sw: SWs }); // trigger
  b += face(38, 61, 0.78, { gap: 6, mw: 12, mh: 7, my: 6, eyeCol: C.cream });
  const mist = a ? flat(star(6, 12, 3.4, 1, 4), C.white, 'opacity=".9"') + flat(star(2, 20, 2.4, 0.8, 4), C.white, 'opacity=".8"') : flat(star(5, 8, 3.4, 1, 4), C.white, 'opacity=".9"') + flat(star(3, 16, 2.4, 0.8, 4), C.white, 'opacity=".8"');
  return `${legs}${squash(38, gy, a ? 1.02 : 0.98, a ? 0.98 : 1.02, b)}${arms}${mist}`;
}
add('enemy_sanitizer_a', () => sanitizer('a'));
add('enemy_sanitizer_b', () => sanitizer('b'));

// ---------- gift card (loot thief) ----------
function giftcard(f) {
  const a = f === 'a', gy = 88;
  const legs = a ? stick([[34, 66], [26, 76], [20, 84]], 3.5, 6) + stick([[48, 66], [56, 74], [64, 82]], 3.5, 6)
    : stick([[34, 66], [38, 76], [36, 86]], 3.5, 6) + stick([[48, 66], [46, 74], [52, 84]], 3.5, 6);
  const arms = a ? stick([[14, 46], [6, 38], [4, 30]], 3.5) + stick([[70, 46], [78, 52], [80, 44]], 3.5)
    : stick([[14, 46], [6, 52], [4, 44]], 3.5) + stick([[70, 46], [78, 38], [80, 30]], 3.5);
  let b = '';
  b += shape([[12, 22], [70, 22], [70, 68], [12, 68]], C.coral, C.coralD, { dx: 4, dy: 3 });
  b += shape([[12, 30], [70, 30], [70, 38], [12, 38]], C.cream, C.creamD, { dx: 3, dy: 2, sw: SWs }); // ribbon bands
  b += shape([[36, 22], [46, 22], [46, 68], [36, 68]], C.gold, C.goldD, { dx: 3, dy: 0, sw: SWs });
  b += shape([[41, 24], [30, 8], [22, 14], [36, 24]], C.gold, C.goldD, { dx: 2, dy: 2, sw: SWs }) + shape([[41, 24], [52, 8], [60, 14], [46, 24]], C.gold, C.goldD, { dx: 2, dy: 2, sw: SWs }); // bow
  b += ell(41, 24, 4, 3.4, C.goldD, null, { sw: SWs });
  b += ell(21, 60, 4.5, 4.5, C.gold, C.goldD, { sw: 1.6 }) + line([[21, 57], [21, 63]], C.plum, 1.4);
  b += face(41, 50, 0.85, { mw: 14, mh: 8, my: 6, eyeCol: C.cream });
  return `${legs}${squash(41, gy, a ? 1.02 : 0.98, a ? 0.98 : 1.02, rot(b, a ? -4 : 4, 41, 68))}${arms}`;
}
add('enemy_giftcard_a', () => giftcard('a'));
add('enemy_giftcard_b', () => giftcard('b'));

// ---------- expired milk (teleporter) ----------
function expired(f) {
  const a = f === 'a', sq = a ? [1.02, 0.97] : [0.98, 1.03], gy = 91;
  const legs = a ? stick([[24, 76], [18, 84], [14, 90]], 3.5, 6) + stick([[43, 76], [47, 83], [53, 90]], 3.5, 6)
    : stick([[24, 76], [27, 84], [26, 90]], 3.5, 6) + stick([[43, 76], [40, 82], [44, 89]], 3.5, 6);
  const arms = a ? stick([[12, 50], [7, 55], [5, 47]], 3.5) + stick([[57, 48], [63, 42], [67, 48]], 3.5)
    : stick([[12, 50], [7, 44], [5, 52]], 3.5) + stick([[57, 48], [63, 52], [67, 44]], 3.5);
  const MG = '#9CB88A', MGD = '#6E8E5E';
  let b = '';
  b += shape([[16, 20], [44, 20], [48, 34], [12, 34]], MG, MGD, { dx: 2, dy: 3 });
  b += shape([[44, 20], [54, 17], [58, 30], [48, 34]], MGD, C.lavD, { dx: 1, dy: 3 });
  b += shape([[17, 11], [42, 10], [43, 21], [16, 21]], C.lav, C.lavD, { dx: 2, dy: 2 });
  b += line([[22, 12], [22, 20]], C.plum, 1.6) + line([[28, 12], [28, 20]], C.plum, 1.6) + line([[34, 12], [34, 20]], C.plum, 1.6);
  b += shape([[48, 34], [58, 30], [58, 74], [48, 79]], MGD, C.lavD, { dx: 2, dy: 0 });
  b += shape([[12, 34], [48, 34], [48, 79], [12, 77]], MG, MGD, { dx: 4, dy: 3 });
  b += shape([[12, 66], [48, 67], [48, 79], [12, 77]], C.lav, C.lavD, { dx: 4, dy: 2 });
  b += ell(20, 41, 4, 3, C.green, C.greenD, { sw: 1.4 }) + ell(42, 71, 3.5, 2.6, C.green, C.greenD, { sw: 1.4 }) + ell(16, 62, 2.6, 2, C.greenL, C.greenD, { sw: 1.2 });
  b += shape([[32, 36], [46, 36], [46, 43], [32, 43]], C.cream, C.creamD, { dx: 1, dy: 1, sw: 1.4 }) + line([[34, 40], [38, 40]], C.coral, 1.8) + line([[40, 40], [44, 40]], C.coral, 1.8); // date stamp
  b += face(30, 54, 1, { mw: 18, mh: 10, my: 8, eyeCol: '#E4F0C2' });
  b += line([[24, 80], [24, 86]], C.green, 2) ;
  return `${legs}${squash(36, gy, sq[0], sq[1], b)}${arms}${a ? line([[20, 6], [16, 0], [22, -4]], C.green, 2) : line([[50, 8], [54, 2], [48, -2]], C.green, 2)}`;
}
add('enemy_expired_a', () => expired('a'));
add('enemy_expired_b', () => expired('b'));

// ---------- bubble gum ----------
function gum(f) {
  const a = f === 'a', gy = 90;
  const PK = '#FF8FC0', PKD = '#D45A92', PKL = '#FFC2DD';
  const legs = a ? stick([[30, 72], [24, 82], [19, 89]], 3.5, 6) + stick([[46, 72], [52, 80], [58, 89]], 3.5, 6)
    : stick([[30, 72], [32, 82], [31, 89]], 3.5, 6) + stick([[46, 72], [44, 80], [48, 88]], 3.5, 6);
  const arms = a ? stick([[14, 50], [8, 56], [6, 48]], 3.5) + stick([[62, 48], [68, 42], [70, 48]], 3.5)
    : stick([[14, 50], [8, 44], [6, 52]], 3.5) + stick([[62, 48], [68, 52], [70, 44]], 3.5);
  let b = '';
  b += shape([[38, 22], [54, 26], [66, 40], [66, 62], [56, 76], [40, 80], [22, 78], [12, 66], [10, 46], [18, 30], [28, 22]], PK, PKD, { dx: 5, dy: 4 });
  b += flat([[22, 34], [32, 28], [34, 32], [26, 42]], PKL);
  b += ell(58, 72, 4, 3, PK, PKD, { sw: 1.6 }) + shape([[12, 70], [18, 76], [14, 82], [10, 76]], PK, PKD, { dx: 1, dy: 1, sw: 1.6 });
  b += face(38, 50, 0.95, { mw: 14, mh: 8, my: 7, teeth: 3 });
  const bubble = a ? ell(52, 30, 10, 9, PKL, PK, { dx: 2, dy: 2, sw: SWs }) : ell(54, 28, 7, 6.5, PKL, PK, { dx: 1, dy: 1, sw: SWs });
  return `${legs}${squash(38, gy, a ? 1.03 : 0.97, a ? 0.97 : 1.03, b)}${arms}${bubble}`;
}
add('enemy_gum_a', () => gum('a'));
add('enemy_gum_b', () => gum('b'));

// ---------- boss: possessed checkout register ----------
function boss(f) {
  const tell = f === 'tell', a = f === 'a', dy = f === 'b' ? -2 : 0;
  const wheel = (x, y) => `<circle cx="${x}" cy="${y}" r="8" fill="${C.plumSoft}" stroke="${C.plum}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3" fill="${C.lavL}" stroke="${C.plum}" stroke-width="1.5"/>`;
  let s = tube([[52, 170], [52, 180]], 3, C.chromeD, 1.5) + tube([[148, 170], [148, 180]], 3, C.chromeD, 1.5);
  s += a ? wheel(52, 184) + wheel(148, 184) + wheel(100, 186) : wheel(54, 185) + wheel(146, 185) + wheel(100, 184);
  let b = '';
  // screen housing
  b += shape([[46, 14], [154, 12], [159, 66], [41, 68]], C.coral, C.coralD, { dx: 5, dy: 5 });
  b += shape([[55, 23], [147, 22], [150, 58], [52, 60]], tell ? '#4A1D2A' : C.plum, null, { sw: SWs });
  const eyeCol = tell ? C.coral : C.gold, eyeHi = tell ? '#FFC0A8' : C.cream;
  b += shape([[60, 33], [88, 29], [90, 46], [64, 50]], eyeCol, tell ? C.coralD : C.goldD, { sw: SWs, dx: 2, dy: 2 }) +
    shape([[140, 33], [112, 29], [110, 46], [136, 50]], eyeCol, tell ? C.coralD : C.goldD, { sw: SWs, dx: 2, dy: 2 });
  b += flat([[64, 34], [78, 32], [78, 35], [65, 38]], eyeHi, 'opacity=".9"') + flat([[136, 34], [122, 32], [122, 35], [135, 38]], eyeHi, 'opacity=".9"');
  b += `<circle cx="80" cy="42" r="3.4" fill="${C.plum}"/><circle cx="120" cy="42" r="3.4" fill="${C.plum}"/>`;
  b += brow(56, 26, 92, 38, 5.5).replace(C.plum, C.cream) + brow(144, 26, 108, 38, 5.5).replace(C.plum, C.cream);
  b += brow(56, 27, 92, 39, 3) + brow(144, 27, 108, 39, 3);
  b += flat([[60, 54], [92, 55], [92, 57], [60, 57]], tell ? C.coral : C.goldD, 'opacity=".5"') + flat([[108, 55], [140, 54], [140, 57], [108, 57]], tell ? C.coral : C.goldD, 'opacity=".5"');
  // keyboard deck
  b += shape([[30, 100], [170, 100], [158, 68], [42, 68]], C.plumSoft, C.plum, { dx: 3, dy: 4 });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) {
    const y = 74 + r * 12, x = 52 + i * 11 - r * 3;
    b += shape(rect(x, y, 8, 7), [C.cream, C.coralL, C.gold][(i + r) % 3], null, { sw: 1.5 });
  }
  b += shape([[34, 98], [166, 98], [170, 106], [30, 106]], C.lav, C.lavD, { dx: 0, dy: 3, sw: SWs + 0.5 });
  // front body
  b += shape([[26, 105], [174, 105], [169, 172], [31, 172]], C.coral, C.coralD, { dx: 6, dy: 4 });
  b += flat([[32, 112], [38, 112], [37, 160], [34, 164]], C.coralL, 'opacity=".5"');
  b += shape(rect(36, 150, 22, 9), C.cream, C.creamD, { dx: 0, dy: 2, sw: SWs }) + line([[40, 154], [54, 154]], C.chromeD, 1.6); // name badge
  b += shape([[26, 168], [174, 168], [170, 174], [30, 174]], C.plum, null, { sw: SWs });
  // mouth: cash drawer
  const mo = tell ? 18 : 0; // drawer flung open
  const jaw = tell ? [[24, 132 + mo], [176, 132 + mo], [184, 160 + mo * 0.3], [16, 160 + mo * 0.3]] : [[38, 132], [162, 132], [168, 148], [32, 148]];
  b += shape(tell ? [[42, 108], [158, 108], [162, 140 + mo], [38, 140 + mo]] : [[44, 110], [156, 110], [152, 135], [48, 135]], '#1E1028', null, { sw: SWs });
  const coinTooth = (x, y) => `<circle cx="${x}" cy="${y}" r="6.2" fill="${C.gold}" stroke="${C.plum}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${C.goldD}" stroke-width="1.6"/>`;
  for (let i = 0; i < 7; i++) b += coinTooth(55 + i * 15, 115);
  b += shape(jaw, tell ? C.chrome : C.chrome, C.chromeD, { dx: 2, dy: 3 });
  for (let i = 0; i < 6; i++) b += coinTooth(62 + i * 15, 132 + mo - (tell ? -1 : 2));
  b += flat([[tell ? 30 : 42, jaw[0][1] + 3], [tell ? 80 : 90, jaw[0][1] + 3], [tell ? 76 : 86, jaw[0][1] + 6], [tell ? 30 : 40, jaw[0][1] + 6]], C.white, 'opacity=".8"');
  // tie
  b += shape([[74, 148 + mo * 0.3], [90, 148 + mo * 0.3], [88, 156 + mo * 0.3], [76, 156 + mo * 0.3]], C.teal, C.tealD, { sw: SWs, dx: 2, dy: 2 });
  b += shape([[76, 156 + mo * 0.3], [88, 156 + mo * 0.3], [95, 182], [82, 188], [70, 182]], C.teal, C.tealD, { dx: 3, dy: 3 });
  b += flat([[77, 164], [90, 162], [91, 166], [76, 168]], C.cream) + flat([[75, 174], [92, 172], [93, 176], [74, 178]], C.cream);
  // receipt tongue
  const t0 = jaw[0][1];
  const tongue = tell
    ? [[104, t0 - 18], [140, t0 - 18], [166, t0 + 10], [184, t0 + 34], [150, t0 + 30], [136, t0 + 40], [118, t0 + 22], [104, t0 + 34], [96, t0 + 16]]
    : a ? [[112, t0 - 18], [140, t0 - 18], [146, t0 + 10], [156, t0 + 30], [150, t0 + 44], [134, t0 + 36], [124, t0 + 28], [116, t0 + 12]]
      : [[112, t0 - 18], [140, t0 - 18], [144, t0 + 14], [140, t0 + 34], [150, t0 + 44], [130, t0 + 44], [120, t0 + 26], [116, t0 + 10]];
  b += shape(tongue, C.cream, C.creamD, { dx: 3, dy: 3 });
  for (let i = 0; i < 4; i++) { const yy = t0 + 2 + i * 9; b += line([[118 + i * 2, yy], [136 + i * 3, yy - 1]], C.chromeD, 1.8); }
  b += flat([[114, t0 - 14], [120, t0 - 14], [120, t0 + 10]], C.white, 'opacity=".8"');
  if (tell) b += spark(30, 40, 11) + spark(172, 36, 11) + line([[14, 70], [20, 78]], C.coral, 3) + line([[186, 66], [180, 74]], C.coral, 3);
  const sq = tell ? [1.03, 0.97] : a ? [1, 1] : [0.99, 1.01];
  return s + squash(100, 176, sq[0], sq[1], `<g transform="translate(0 ${dy})">${b}</g>`);
}
add('boss_a', () => boss('a'));
add('boss_b', () => boss('b'));
add('boss_tell', () => boss('tell'));

// ---------- per-theme bosses (aisle 8): same 200x200 frame, ground ~y176, a/b walk + tell ----------
const bossWheel = (x, y) => `<circle cx="${x}" cy="${y}" r="8" fill="${C.plumSoft}" stroke="${C.plum}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3" fill="${C.lavL}" stroke="${C.plum}" stroke-width="1.5"/>`;
const bossFrame = (f, wheels, inner) => {
  const a = f === 'a', dy = f === 'b' ? -2 : 0, sq = f === 'tell' ? [1.03, 0.97] : a ? [1, 1] : [0.99, 1.01];
  return wheels + squash(100, 176, sq[0], sq[1], `<g transform="translate(0 ${dy})">${inner}</g>`);
};
const bossWheels = (f) => (f === 'a' ? bossWheel(52, 184) + bossWheel(148, 184) + bossWheel(100, 186) : bossWheel(54, 185) + bossWheel(146, 185) + bossWheel(100, 184));

// Walk-In Freezer (frozen): frosty cabinet, icicle teeth, cold breath.
function bossFrozen(f) {
  const tell = f === 'tell', a = f === 'a';
  const eyeCol = tell ? C.coral : C.sky, eyeDk = tell ? C.coralD : C.blueD, eyeHi = tell ? '#FFC0A8' : C.white;
  let b = shape([[32, 38], [168, 38], [172, 172], [28, 172]], C.frost, C.frostD, { dx: 6, dy: 5 });
  b += flat([[36, 46], [43, 46], [42, 160], [38, 164]], C.white, 'opacity=".6"');
  b += shape([[48, 54], [152, 54], [152, 162], [48, 162]], C.white, C.frostD, { dx: 3, dy: 3, sw: SWs + 0.5 });
  b += shape([[154, 70], [163, 70], [163, 128], [154, 128]], C.chrome, C.chromeD, { dx: 2, dy: 2, sw: SWs });
  // compressor cap with vent slats + LED
  b += shape([[42, 14], [158, 14], [168, 42], [32, 42]], C.chrome, C.chromeD, { dx: 4, dy: 4 });
  for (let i = 0; i < 5; i++) b += line([[64 + i * 18, 20], [61 + i * 18, 36]], C.chromeD, 3);
  b += `<circle cx="148" cy="26" r="4.2" fill="${tell ? C.coral : C.teal}" stroke="${C.plum}" stroke-width="1.6"/>`;
  // eyes
  b += shape([[58, 78], [90, 70], [92, 90], [62, 94]], eyeCol, eyeDk, { sw: SWs, dx: 2, dy: 2 }) + shape([[142, 78], [110, 70], [108, 90], [138, 94]], eyeCol, eyeDk, { sw: SWs, dx: 2, dy: 2 });
  b += flat([[63, 79], [78, 74], [78, 78], [64, 83]], eyeHi, 'opacity=".9"') + flat([[137, 79], [122, 74], [122, 78], [136, 83]], eyeHi, 'opacity=".9"');
  b += `<circle cx="78" cy="84" r="3.4" fill="${C.plum}"/><circle cx="122" cy="84" r="3.4" fill="${C.plum}"/>`;
  b += brow(54, 66, 92, 78, 5.5).replace(C.plum, C.white) + brow(146, 66, 108, 78, 5.5).replace(C.plum, C.white) + brow(54, 67, 92, 79, 3) + brow(146, 67, 108, 79, 3);
  // icicle-toothed mouth
  const mo = tell ? 10 : 0;
  b += shape([[56, 112 - mo], [144, 112 - mo], [140, 152 + mo], [60, 152 + mo]], '#1E1028', null, { sw: SWs });
  for (let i = 0; i < 6; i++) {
    const x = 62 + i * 15;
    b += shape([[x, 112 - mo], [x + 13, 112 - mo], [x + 6.5, 126 + (i % 2) * 5]], C.white, C.frostD, { sw: SWs, dx: 1, dy: 1 });
    b += shape([[x + 1, 152 + mo], [x + 13, 152 + mo], [x + 7, 140 - (i % 2) * 5 - mo * 0.4]], C.white, C.frostD, { sw: SWs, dx: 1, dy: 1 });
  }
  b += snowflake(46, 148, 7, C.sky, 2) + snowflake(158, 150, 6, C.sky, 1.8);
  // icicles under the cap
  for (const [x, h] of [[44, 14], [70, 22], [100, 16], [130, 24], [156, 12]]) b += shape([[x - 6, 40], [x + 6, 40], [x + 0.5, 42 + h + (a ? 0 : 3)]], C.white, C.frostD, { sw: SWs, dx: 1, dy: 1 });
  if (tell) { // cold breath
    for (const [x, y, r] of [[40, 142, 11], [24, 128, 8], [160, 142, 11], [176, 128, 8]]) b += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.frost}" stroke="${C.plum}" stroke-width="2" opacity=".95"/>`;
    b += spark(26, 40, 11, C.sky) + spark(176, 38, 11, C.sky);
  }
  return bossFrame(f, bossWheels(f), b);
}
add('boss_frozen_a', () => bossFrozen('a'));
add('boss_frozen_b', () => bossFrozen('b'));
add('boss_frozen_tell', () => bossFrozen('tell'));

// Industrial Oven (bakery): brick-orange cabinet, glowing door window with an angry face, smokestack.
function bossBakery(f) {
  const tell = f === 'tell', a = f === 'a';
  let b = '';
  // smokestack + puffs
  b += shape([[46, 22], [76, 22], [80, 66], [42, 66]], C.chrome, C.chromeD, { dx: 4, dy: 3 }) + shape([[42, 18], [80, 18], [80, 26], [42, 26]], C.chromeD, null, { sw: SWs });
  const puff = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.lavL}" stroke="${C.plum}" stroke-width="2" opacity=".9"/>`;
  b += a ? puff(60, 10, 8) + puff(70, 1, 6) : puff(64, 9, 9) + puff(54, 0, 6);
  // body + top panel with dials
  b += shape([[28, 62], [172, 62], [176, 172], [24, 172]], C.bread, C.breadD, { dx: 6, dy: 5 });
  b += flat([[32, 70], [39, 70], [38, 160], [34, 164]], C.breadL, 'opacity=".6"');
  b += shape([[30, 62], [170, 62], [166, 76], [34, 76]], C.chrome, C.chromeD, { dx: 2, dy: 3, sw: SWs + 0.5 });
  for (const x of [56, 84, 116, 144]) b += `<circle cx="${x}" cy="69" r="4" fill="${C.gold}" stroke="${C.plum}" stroke-width="1.8"/>`;
  // door frame + glowing window
  b += shape([[40, 84], [160, 84], [164, 156], [36, 156]], C.chromeD, C.plum, { dx: 3, dy: 3 });
  const glow = tell ? C.coral : C.gold, glowD = tell ? C.coralD : C.goldD;
  b += shape([[48, 92], [152, 92], [155, 148], [45, 148]], glow, glowD, { sw: SWs, dx: 3, dy: 3 });
  b += flat([[52, 96], [74, 96], [58, 120]], tell ? C.coralL : '#FFE08A', 'opacity=".8"');
  b += face(100, 112, 2.2, { gap: 9, tilt: 6, my: 7, mw: 17, mh: 9, teeth: 5, eyeCol: tell ? '#FFD6C8' : C.cream });
  // door handle + lower drawer
  b += tube([[52, 160], [148, 160]], 5, C.chrome, 2);
  b += shape([[34, 168], [166, 168], [170, 176], [30, 176]], C.plum, null, { sw: SWs });
  // baguette on top of the stack
  b += shape([[120, 30], [158, 22], [162, 34], [124, 44]], C.bread, C.breadD, { sw: SWs + 0.5, dx: 2, dy: 3 }) + line([[130, 34], [134, 28]], C.breadD, 2) + line([[142, 31], [146, 25]], C.breadD, 2);
  if (tell) { // flames from the door seam + sparks
    for (const x of [58, 86, 114, 142]) b += shape([[x - 7, 88], [x + 7, 88], [x + 2, 66 - (x % 3) * 4], [x - 1, 78]], C.gold, C.coral, { sw: SWs, dx: 1, dy: 2 });
    b += spark(20, 44, 11) + spark(180, 40, 11);
  }
  return bossFrame(f, bossWheels(f), b);
}
add('boss_bakery_a', () => bossBakery('a'));
add('boss_bakery_b', () => bossBakery('b'));
add('boss_bakery_tell', () => bossBakery('tell'));

// Smart-TV Wall (electronics): a trolley of mismatched screens, the big one has the face; live cables dangle.
function bossElectronics(f) {
  const tell = f === 'tell', a = f === 'a';
  const r = rng(7);
  let b = '';
  // cables behind
  b += tube([[40, 150], [22, 160], [a ? 14 : 20, 176]], 3.5, C.teal, 1.8) + tube([[162, 150], [180, 162], [a ? 186 : 178, 176]], 3.5, C.coral, 1.8);
  // antennas
  b += line([[84, 30], [70, 6]], C.plum, 3) + line([[116, 30], [132, 4]], C.plum, 3) + `<circle cx="70" cy="6" r="4" fill="${tell ? C.coral : C.gold}" stroke="${C.plum}" stroke-width="2"/><circle cx="132" cy="4" r="4" fill="${tell ? C.coral : C.gold}" stroke="${C.plum}" stroke-width="2"/>`;
  // chassis
  b += shape([[22, 26], [178, 26], [178, 164], [22, 164]], C.plumSoft, C.plum, { dx: 5, dy: 5 });
  // big face screen
  b += shape([[32, 34], [168, 34], [168, 100], [32, 100]], C.blueD, null, { sw: SWs + 0.5 });
  b += shape([[38, 40], [162, 40], [162, 94], [38, 94]], tell ? '#4A1D2A' : '#14213D', null, { sw: SWs });
  const eyeCol = tell ? C.coral : C.sky;
  b += shape([[50, 54], [88, 48], [90, 68], [54, 72]], eyeCol, tell ? C.coralD : C.blue, { sw: SWs, dx: 2, dy: 2 }) + shape([[150, 54], [112, 48], [110, 68], [146, 72]], eyeCol, tell ? C.coralD : C.blue, { sw: SWs, dx: 2, dy: 2 });
  b += `<circle cx="72" cy="62" r="3.6" fill="${C.plum}"/><circle cx="128" cy="62" r="3.6" fill="${C.plum}"/>`;
  b += brow(46, 46, 90, 58, 5.5).replace(C.plum, C.cream) + brow(154, 46, 110, 58, 5.5).replace(C.plum, C.cream);
  // equalizer mouth
  for (let i = 0; i < 11; i++) {
    const h = tell ? 12 + ((i * 7) % 5) * 3 : 5 + ((i * 5 + (a ? 0 : 3)) % 6) * 2;
    b += flat(rect(60 + i * 8, 90 - h, 5, h), i % 3 === 0 ? C.coral : i % 3 === 1 ? C.gold : C.teal);
  }
  b += flat([[42, 44], [62, 42], [48, 56]], C.white, 'opacity=".25"');
  // three smaller TVs along the bottom
  const tvs = [[34, C.teal], [78, C.coral], [122, C.gold]];
  tvs.forEach(([x, col], i) => {
    b += shape(rect(x, 108, 44, 46), C.plum, null, { sw: SWs });
    for (let k = 0; k < 7; k++) { const rx = x + 3 + r() * 34, ry = 111 + r() * 38; b += flat(rect(rx, ry, 4 + r() * 6, 3 + r() * 5), [col, C.cream, C.sky][k % 3], 'opacity=".85"'); }
    if (i === 1) b += line([[x + 8, 116], [x + 36, 146]], C.cream, 2.4) + line([[x + 36, 116], [x + 8, 146]], C.cream, 2.4);
  });
  b += shape([[26, 156], [174, 156], [170, 172], [30, 172]], C.lav, C.lavD, { dx: 0, dy: 3, sw: SWs + 0.5 });
  if (tell) b += spark(16, 40, 11, C.gold) + spark(184, 36, 11, C.gold) + line([[8, 120], [20, 112], [12, 104]], C.gold, 3) + line([[192, 118], [180, 110], [188, 102]], C.gold, 3);
  return bossFrame(f, bossWheels(f), b);
}
add('boss_electronics_a', () => bossElectronics('a'));
add('boss_electronics_b', () => bossElectronics('b'));
add('boss_electronics_tell', () => bossElectronics('tell'));

// Self-Checkout Kiosk (checkout): teal kiosk, scanner glare, card-reader mouth, receipt tongue, bagging-platform base.
function bossCheckout(f) {
  const tell = f === 'tell', a = f === 'a';
  let b = '';
  // bagging platform base with belt stripes
  b += shape([[18, 150], [182, 150], [190, 174], [10, 174]], C.chrome, C.chromeD, { dx: 0, dy: 4 });
  for (let i = 0; i < 9; i++) b += line([[28 + i * 18 + (a ? 0 : 6), 154], [24 + i * 18 + (a ? 0 : 6), 170]], C.chromeD, 3);
  // body
  b += shape([[40, 30], [160, 30], [166, 150], [34, 150]], C.teal, C.tealD, { dx: 6, dy: 5 });
  b += flat([[44, 38], [51, 38], [50, 140], [46, 144]], C.mintL, 'opacity=".5"');
  // hood + scanner light
  b += shape([[34, 14], [166, 14], [160, 34], [40, 34]], C.tealD, null, { sw: SW });
  b += shape(rect(70, 20, 60, 8), tell ? C.coral : '#FF6B5C', null, { sw: SWs }) + flat(rect(74, 22, 52, 2.5), '#FFC0A8', 'opacity=".9"');
  // screen
  b += shape([[50, 42], [150, 42], [150, 104], [50, 104]], C.plum, null, { sw: SWs + 0.5 });
  const eyeCol = tell ? C.coral : C.gold;
  b += shape([[58, 58], [90, 52], [92, 72], [62, 76]], eyeCol, tell ? C.coralD : C.goldD, { sw: SWs, dx: 2, dy: 2 }) + shape([[142, 58], [110, 52], [108, 72], [138, 76]], eyeCol, tell ? C.coralD : C.goldD, { sw: SWs, dx: 2, dy: 2 });
  b += `<circle cx="78" cy="66" r="3.4" fill="${C.plum}"/><circle cx="122" cy="66" r="3.4" fill="${C.plum}"/>`;
  b += brow(54, 50, 92, 62, 5.5).replace(C.plum, C.cream) + brow(146, 50, 108, 62, 5.5).replace(C.plum, C.cream);
  b += flat(rect(64, 86, 72, 5), tell ? C.coral : C.mint, 'opacity=".7"') + flat(rect(64, 95, 40, 4), tell ? C.coral : C.mint, 'opacity=".5"');
  // card-reader mouth + keypad
  b += shape([[56, 112], [144, 112], [144, 134], [56, 134]], '#1E1028', null, { sw: SWs });
  for (let i = 0; i < 7; i++) b += flat([[60 + i * 12, 112], [70 + i * 12, 112], [65 + i * 12, 121]], C.cream);
  b += flat(rect(60, 128, 80, 3), tell ? C.coral : C.sky);
  for (let i = 0; i < 4; i++) b += shape(rect(46 + i * 14, 138, 10, 8), [C.cream, C.coralL, C.gold, C.mintL][i], null, { sw: 1.5 });
  // receipt tongue
  const t0 = 134;
  const tongue = tell ? [[112, t0 - 4], [146, t0 - 4], [160, t0 + 24], [174, t0 + 40], [144, t0 + 34], [132, t0 + 44], [118, t0 + 24]]
    : [[116, t0 - 4], [144, t0 - 4], [148, t0 + 18], [146, t0 + 32], [158, t0 + 38], [136, t0 + 36], [124, t0 + 22]];
  b += shape(tongue, C.cream, C.creamD, { dx: 3, dy: 3 });
  for (let i = 0; i < 3; i++) b += line([[122 + i * 2, t0 + 6 + i * 8], [138 + i * 2, t0 + 5 + i * 8]], C.chromeD, 1.8);
  if (tell) b += spark(24, 44, 11) + spark(178, 40, 11) + line([[14, 74], [22, 82]], C.coral, 3) + line([[188, 70], [180, 78]], C.coral, 3);
  return bossFrame(f, '', b);
}
add('boss_checkout_a', () => bossCheckout('a'));
add('boss_checkout_b', () => bossCheckout('b'));
add('boss_checkout_tell', () => bossCheckout('tell'));

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

add('icon_snowcone', () => {
  let s = S5([[62, 82], [134, 82], [98, 168]], C.cream, C.creamD, { dx: 6, dy: 5 });
  for (let i = 0; i < 3; i++) s += flat([[70 + i * 12, 88], [78 + i * 12, 88], [98, 150]].map(([x, y]) => [x, y]), C.coral, 'opacity=".55"');
  s += [[78, 70, 22, C.sky], [118, 70, 22, C.teal], [98, 52, 24, '#EAF7FF']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="${C.plum}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="${C.white}" opacity=".8"/>`).join('');
  s += spk(140, 40, 8) + spk(52, 52, 6);
  return icon(s, 172);
});

add('icon_moldybread', () => {
  let s = S5([[48, 150], [148, 150], [152, 96], [140, 70], [104, 58], [64, 70], [46, 96]], C.bread, C.breadD, { dx: 6, dy: 5 });
  s += flat([[60, 88], [76, 74], [96, 70], [90, 82], [68, 98]], C.cream, 'opacity=".55"');
  s += [[70, 108, 13], [112, 94, 16], [128, 126, 11], [88, 130, 9], [96, 82, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 2.5}" fill="${C.plum}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${C.green}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.35}" fill="#CFEFA6"/>`).join('');
  s += [[150, 60, 5], [44, 70, 4], [160, 100, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.green}" stroke="${C.plum}" stroke-width="1.6"/>`).join('');
  return icon(s, 164);
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
