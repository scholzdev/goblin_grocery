// Test Lab bench layout check: the bench must stay inside the viewport and never overlap the cart, the combos, the deals column, the next button,
// the HUD or the sim tags, in the cart editor and in the arena, on every tab, at both reference sizes.
// Usage: node tools/lab-layout-check.mjs   (starts its own dev server or uses $GG_URL; needs system Chrome, like tools/verify-shot.mjs)
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';

const BASE = await devUrl();
const at = (q) => new URL(q, BASE).href;
const SIZES = [[1280, 800], [1672, 941]];
const AVOID = ['#shop .grid-wrap', '#shop .combos', '#shop .col-right', '#shop .bottom', '#shop .col-mid', '#shop .shelf', '#shop .sell', '#shop .cart-title', '#hud', '#punch', '#bossbar', '#simtag', '#simnote'];
const LAB = { aisle: 2, dept: 'frozen', shift: 0, starter: 'toaster', weapon: 'toaster', money: 999, cart: [5, 4], shelf: 6, shopLevel: 1, god: true, event: 'none', mod: 'none', sandbox: true };

const b = await chromium.launch({ channel: 'chrome' });
let failed = 0, compared = 0;

async function check(page, label) {
  const { hits, n } = await page.evaluate((avoid) => {
    const bench = document.querySelector('#labbench');
    if (!bench || bench.classList.contains('hidden')) return { hits: ['bench is not visible'], n: 0 };
    const r = bench.getBoundingClientRect(), out = [];
    let n = 0;
    if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) out.push(`outside the viewport (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)})`);
    for (const sel of avoid) {
      const el = document.querySelector(sel);
      if (!el || el.classList.contains('hidden') || getComputedStyle(el).display === 'none') continue;
      const q = el.getBoundingClientRect();
      if (q.width) n++;
      if (q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top) out.push(`overlaps ${sel}`);
    }
    const body = bench.querySelector('.lb-body');
    if (body && body.scrollHeight > body.clientHeight + 1 && !bench.querySelector('.lb-pal')) out.push('scrolls');
    return { hits: out, n };
  }, AVOID);
  compared += n;
  const bad = hits.length > 0;
  if (bad) failed++;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${label}${bad ? ': ' + hits.join(', ') : ''}`);
}

async function tabs(page, label) {
  for (const tab of await page.$$eval('#labbench [data-lb-tab]', (els) => els.map((e) => e.dataset.lbTab))) {
    await page.click(`#labbench [data-lb-tab="${tab}"]`);
    await page.waitForTimeout(150);
    await check(page, `${label} ${tab}`);
  }
}

for (const [w, h] of SIZES) {
  const page = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(at('?lab=1'), { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.evaluate((o) => window.__gg.flow.startLab(o), LAB);
  await page.waitForTimeout(500);
  await tabs(page, `${w}x${h} shop`);
  await page.evaluate(() => window.__gg.flow.labToArena());
  await page.waitForTimeout(1500);
  await tabs(page, `${w}x${h} arena`);
  await page.goto(at('?sim=example'), { timeout: 120000 });
  await page.waitForTimeout(2000);
  await tabs(page, `${w}x${h} sim arena`);
  await page.keyboard.press('F8');
  await page.waitForTimeout(600);
  await tabs(page, `${w}x${h} sim shop`);
  if (errs.length) { failed++; console.log('FAIL page errors:', errs.join(' | ')); }
  await page.close();
}
await b.close();
if (compared < 100) { failed++; console.log(`FAIL only ${compared} element comparisons ran`); }
console.log(failed ? `${failed} problem(s)` : 'layout ok');
process.exit(failed ? 1 : 0);
