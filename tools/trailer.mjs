// Renders the 30 s Steam trailer: release/trailer/goblin-grocery-trailer.mp4
// Usage: node tools/trailer.mjs   (needs the dev server on :5173; DEV handles __gg/__arena are used, no src changes)
// Capture: Playwright fake clock, one page.clock.runFor(16) + screenshot per output frame -> perfectly smooth 60 fps.
// CSS animations are not covered by the fake clock, so they are paused and driven by hand every frame.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL ?? 'http://localhost:5173/';
const OUT = join(ROOT, 'release/trailer');
const FRAMES = process.env.FRAMES ?? join(tmpdir(), 'gg-trailer-frames');
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const FPS = 60;
const STEP_MS = 16; // fake-timers fires rAF every 16 ms: exactly one game frame per output frame
const SKIP_CAPTURE = process.env.RENDER_ONLY === '1'; // reuse existing frames, only (re)build the mp4

const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const ids = (text, re) => [...text.matchAll(re)].map((m) => m[1]);
const recipeIds = ids(src('src/data/recipes.ts'), /^\s*id: '(\w+)', short:/gm);
const unlockIds = ids(src('src/data/unlocks.ts'), /^\s*\{ id: '([\w-]+)', kind:/gm);
const tutIds = ids(src('src/ui/tutorial-core.ts'), /\{ id: '(\w+)', at:/g);
const DEMO_RECIPE = 'coldStorage'; // Vacuum + Ice Pack: discovered live in the shop scene

const settings = { master: 0.8, music: 0.45, sfx: 0.8, reducedMotion: false, shake: true, hintSeen: true, tutorialDone: true, tutorialSeen: tutIds, fullscreen: true, language: 'en' };
const profile = {
  v: 1,
  stats: { runs: 10, wins: 3, losses: 6, kills: 2000, coins: 5000, bestWave: 8, combos: recipeIds.length - 1, bestOvertime: 2,
    deptClears: { main: 12, bakery: 12, frozen: 12, checkout: 12, electronics: 12, clearance: 3, boss: 3 },
    bestShift: { toaster: 3, pan: 3, coupon: 3, night: 3 } },
  recipes: recipeIds.filter((r) => r !== DEMO_RECIPE), unlocked: unlockIds, goblin: 'classic', cart: 'chrome', enemies: {},
};

if (!SKIP_CAPTURE) {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
}
mkdirSync(OUT, { recursive: true });

let n = 0;          // frames written
let vt = 0;         // virtual ms (drives the hand-stepped CSS animations, also while skipping)
let cap = null;     // {text, from, to}
let cursor = { x: 960, y: 540, show: false, down: false };
let zoom = 1;
let endcard = null; // {scale, opacity} while the end card is up
const sfx = [];     // {t, name} for the audio mix
const mark = (name) => sfx.push({ t: n / FPS, name });

let page;
const capState = () => {
  if (!cap) return { text: '', a: 0, y: 0 };
  const age = n - cap.from, left = cap.to - n;
  const a = Math.max(0, Math.min(1, age / 10, left / 8));
  const e = 1 - (1 - Math.min(1, age / 10)) ** 3;
  return { text: cap.text, a, y: (1 - e) * 34, top: cap.top };
};

/** Advance the game one output frame; optionally write it. */
async function frame(write = true) {
  await page.clock.runFor(STEP_MS); vt += STEP_MS;
  await page.evaluate((st) => window.__tr.tick(st), { t: vt, cap: capState(), cur: cursor, zoom, endcard });
  if (write && !SKIP_CAPTURE) await page.screenshot({ path: join(FRAMES, `${String(n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  if (write) n++;
}
const hold = async (k) => { for (let i = 0; i < k; i++) await frame(); };
/** Run the game without recording (setup behind a hard cut). */
const skip = async (ms) => { for (let d = 0; d < ms; d += 100) { const k = Math.min(100, ms - d); await page.clock.runFor(k); vt += k; await page.evaluate((st) => window.__tr.tick(st), { t: vt, cap: capState(), cur: cursor, zoom, endcard }); } };
const caption = (text, frames, top = false) => { cap = { text, from: n, to: n + frames, top }; };
/** Shrinks the stage by 120 px so captions sit in a free band under the UI (loadout, shop, route). */
const band = (on) => page.evaluate((on) => { const st = document.getElementById('stage'); st.style.height = on ? '960px' : ''; document.body.style.alignContent = on ? 'start' : ''; }, on);

const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
async function moveTo(x, y, frames) {
  const x0 = cursor.x, y0 = cursor.y;
  for (let i = 1; i <= frames; i++) {
    const u = ease(i / frames);
    cursor.x = x0 + (x - x0) * u; cursor.y = y0 + (y - y0) * u;
    await page.mouse.move(cursor.x, cursor.y);
    await frame();
  }
}
const center = async (sel) => {
  const r = await page.locator(sel).first().boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
async function clickAt(sel, travel) {
  const c = await center(sel);
  await moveTo(c.x, c.y, travel);
  cursor.down = true; await page.mouse.down(); await hold(4);
  await page.mouse.up(); cursor.down = false; mark('click'); await hold(3);
}

// ───────────────────────── in-page helpers ─────────────────────────
const PAGE_INIT = ({ settings, profile }) => {
  localStorage.setItem('goblin-grocery.settings.v1', JSON.stringify(settings));
  localStorage.setItem('goblin-grocery.profile.v1', JSON.stringify(profile));
  window.addEventListener('DOMContentLoaded', () => {
    const css = document.createElement('style');
    css.textContent = `
      #tr-cap { position: fixed; left: 0; right: 0; bottom: 44px; text-align: center; z-index: 99990; pointer-events: none; opacity: 0;
        font-family: var(--display); font-size: 62px; letter-spacing: 0.03em; color: #FFF2D5; text-transform: uppercase;
        -webkit-text-stroke: 9px #30203F; paint-order: stroke fill; text-shadow: 0 5px 0 #30203F, 0 9px 14px rgba(48,32,63,.45); }
      #tr-cur { position: fixed; z-index: 99999; pointer-events: none; width: 34px; height: 34px; display: none; filter: drop-shadow(2px 3px 2px rgba(0,0,0,.35)); }
      #tr-end { position: fixed; inset: 0; z-index: 99995; display: none; flex-direction: column; align-items: center; justify-content: center;
        background: radial-gradient(ellipse at 50% 45%, #5a4170 0%, #30203F 62%, #22162e 100%); font-family: var(--display); }
      #tr-end .logo { transform: rotate(-4deg); }
      #tr-end .l1, #tr-end .l2 { display: block; line-height: .9; }
      #tr-end .l1 { font-size: 230px; color: #FFF2D5; text-shadow: 10px 10px 0 #170d20; }
      #tr-end .l2 { font-size: 262px; color: #F45F52; text-shadow: 10px 10px 0 #170d20; margin-left: 60px; }
      #tr-end .wl { margin-top: 70px; font-size: 76px; color: #FFF2D5; background: #F45F52; border: 6px solid #170d20; border-radius: 22px;
        padding: 20px 56px 12px; box-shadow: 0 10px 0 #170d20; letter-spacing: .04em; transform: rotate(2deg); }`;
    document.head.append(css);
    const cap = document.createElement('div'); cap.id = 'tr-cap';
    const cur = document.createElement('div'); cur.id = 'tr-cur';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11.2 13.4 L18 13 Z" fill="#fff" stroke="#30203F" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    const end = document.createElement('div'); end.id = 'tr-end';
    end.innerHTML = '<div class="logo"><span class="l1">Goblin</span><span class="l2">Grocery</span></div><div class="wl">Wishlist on Steam</div>';
    document.body.append(cap, cur, end);
    const T = { };
    window.__tr = {
      tick({ t, cap: c, cur: k, zoom, endcard }) {
        // CSS animations/transitions ignore the fake clock: freeze them and set their time ourselves.
        for (const a of document.getAnimations()) {
          if (a.__t0 === undefined) { a.pause(); a.__t0 = t; }
          const cur = t - a.__t0, end = a.effect?.getComputedTiming().endTime;
          if (end !== undefined && Number.isFinite(end) && cur >= end) a.finish(); else a.currentTime = cur;
        }
        cap.textContent = c.text; cap.style.opacity = String(c.a); cap.style.transform = `translateY(${c.top ? -c.y : c.y}px)`; cap.style.top = c.top ? '172px' : 'auto'; cap.style.bottom = c.top ? 'auto' : '38px';
        cur.style.display = k.show ? 'block' : 'none';
        cur.style.transform = `translate(${k.x - 3}px, ${k.y - 2}px) scale(${k.down ? 0.88 : 1})`;
        document.getElementById('stage').style.transform = zoom === 1 ? '' : `scale(${zoom})`;
        end.style.display = endcard ? 'flex' : 'none';
        if (endcard) { end.style.opacity = String(endcard.opacity); end.firstElementChild.style.scale = String(endcard.scale); }
      },
    };
  });
};

/** Strong, varied cart (4 weapons, 3 active combos) + a bot that kites like the botrun script and never dies. */
const SETUP_CART = () => {
  const { store, rules } = window.__gg; const s = store.state;
  const L = [['fan', 0, 0, 1], ['toaster', 1, 0, 3], ['fuel', 3, 0, 2], ['pan', 4, 0, 3], ['magnet', 0, 2, 1], ['nailgun', 1, 2, 2], ['battery', 3, 2, 2], ['bell', 4, 3, 1], ['hotsauce', 1, 1, 1], ['vacuum', 5, 0, 2]];
  s.inventory.cols = 7; s.inventory.rows = 5;
  s.inventory.placed = L.map(([type, x, y, tier]) => ({ uid: rules.newUid(s), type, x, y, rot: 0, tier }));
  rules.recomputeBuild(s);
  s.hp = s.build.maxHp;
  return { recipes: s.build.recipes.map((r) => r.id), weapons: s.build.weapons.map((w) => w.id ?? w.type) };
};
const START_BOT = () => {
  if (window.__bot) return;
  setInterval(() => { // keeps some damage on screen but never dies
    const s = window.__gg.store.state;
    if (s.phase === 'combat' && s.hp < s.build.maxHp * 0.7) s.hp = s.build.maxHp;
    const b = window.__arena?.boss; if (b && b.hp < b.maxHp * 0.5) b.hp = b.maxHp * 0.5; // the Manager survives the whole clip
  }, 30);
  window.__bot = setInterval(() => {
    const a = window.__arena, s = window.__gg.store.state;
    if (!a || !a.player || (s.phase !== 'combat' && s.phase !== 'checkout')) return;
    if (s.phase !== 'combat') return;
    const p = a.player; let vx = 0, vy = 0;
    for (const e of a.enemies) {
      if (!e.alive) continue;
      const nr = a.playerNear(e.x, e.y); const dx = nr.x - e.x, dy = nr.y - e.y, d = nr.d || 1;
      if (d < 300) { const w = (e.def.behavior === 'boss' ? 3 : 1) / (d * d); vx += dx * w * 1000; vy += dy * w * 1000; }
    }
    for (const sh of a.arsenal.enemyShots) if (sh.active) {
      const nr = a.playerNear(sh.x, sh.y); const dx = nr.x - sh.x, dy = nr.y - sh.y, d = nr.d || 1;
      if (d < 160) { vx += dx / (d * d) * 1500; vy += dy / (d * d) * 1500; }
    }
    const c = window.__center ?? { x: 640, y: 480 };
    vx += (c.x - p.x) * 0.004; vy += (c.y - p.y) * 0.004;
    const l = Math.hypot(vx, vy);
    const near = a.enemies.some((e) => e.alive && a.playerNear(e.x, e.y).d < 90);
    a.devInput = l > 0.05 ? { x: vx / l, y: vy / l, shove: near } : { x: 0, y: 0, shove: near };
  }, 80);
};
/** Jump to aisle `wave` of department `dept` (optionally a forced event) with the full cart. */
const JUMP = ({ dept, wave, event }) => {
  const { store, flow } = window.__gg; const s = store.state;
  s.department = dept; s.wave = wave; s.phase = 'combat'; s.labEvent = event; s.modifier = 'none';
  s.hp = s.build.maxHp; flow.restartArena(); store.changed();
};
/** After the arena restarted: dense crowd now, event starts immediately, showcase enemies + elites around the goblin. */
const POPULATE = async ({ time, event, extra }) => {
  const a = window.__arena; a.waveTime = time;
  if (event && a.aisleEvent?.roll) a.aisleEvent.roll.startAt = 0.2;
  if (extra) {
    const { createEnemy } = await import('/src/scenes/enemies.ts');
    const p = a.player; const list = [['beans', 0], ['cereal', 0], ['honey', 0], ['gum', 0], ['giftcard', 0], ['baguette', 1], ['soda', 1], ['beans', 0], ['cereal', 0], ['gum', 0]];
    list.forEach(([id, elite], i) => {
      const ang = (i / list.length) * Math.PI * 2 + 0.4, r = 300 + (i % 3) * 60;
      const x = Math.max(120, Math.min(1160, p.x + Math.cos(ang) * r)), y = Math.max(150, Math.min(720, p.y + Math.sin(ang) * r * 0.75));
      a.enemies.push(createEnemy(a, id, x, y, a.plan.hpScale, a.plan.speedScale, !!elite, a.plan.dmgScale));
    });
  }
};

// ───────────────────────── capture ─────────────────────────
async function capture() {
  const browser = await chromium.launch({ channel: 'chrome' });
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.addInitScript(PAGE_INIT, { settings, profile });
  await page.clock.install({ time: 0 });
  await page.goto(URL);
  for (let i = 0; i < 300; i++) { await page.clock.runFor(100); if (await page.$('#title:not(.hidden)')) break; await page.waitForTimeout(40); }
  await skip(800);

  // 1. Title (0-2 s): hold with a slow push-in, the cursor drifts toward PLAY.
  cursor = { x: 1500, y: 820, show: false, down: false };
  const play = await center('[data-act="play"]');
  for (let i = 0; i < 120; i++) {
    zoom = 1 + 0.05 * (i / 120);
    if (i === 55) cursor.show = true;
    if (i >= 55) { const u = ease((i - 55) / 64); cursor.x = 1500 + (play.x - 1500) * u; cursor.y = 820 + (play.y - 820) * u; await page.mouse.move(cursor.x, cursor.y); }
    await frame();
  }
  zoom = 1;
  cursor.down = true; await page.mouse.down(); await skip(48); await page.mouse.up(); cursor.down = false; mark('click');

  // 2. Loadout (2-4 s)
  await band(true); await skip(300);
  console.log('band set');
  caption('Pick your goblin, weapon and department', 112);
  await hold(6);
  await clickAt('[data-theme="bakery"]', 24);
  await clickAt('[data-weapon="pan"]', 22);
  await clickAt('[data-act="start-run"]', 28);
  await hold(Math.max(0, 240 - n));
  cursor.show = false; await band(false); await skip(300);
  console.log('loadout done at frame', n);
  if (process.env.STOP === 'loadout') { await browser.close(); return; }

  // 3. Combat, Bakery aisle 5 (4-9 s)
  await page.evaluate(START_BOT);
  console.log('cart', await page.evaluate(SETUP_CART));
  await page.evaluate(JUMP, { dept: 'bakery', wave: 5 });
  await skip(300);
  await page.evaluate(POPULATE, { time: 22, extra: true });
  await skip(1800);
  caption('Auto-battle waves of angry groceries', 292);
  const shoveAt = new Set([60, 170]);
  for (let i = 0; i < 300; i++) { if (shoveAt.has(i)) mark('shove'); await frame(); }
  console.log('combat done at frame', n, await page.evaluate(() => ({ hp: window.__gg.store.state.hp, en: window.__arena.enemies.length, phase: window.__gg.store.state.phase })));

  // 4. Shop (9-14 s): buy a card, then drag the Ice Pack next to the Vacuum -> combo discovered.
  await page.evaluate(() => {
    const { store, flow, rules } = window.__gg; const s = store.state;
    window.__arena.devInput = { x: 0, y: 0 };
    flow.endWave();
    s.money = 96; rules.labAddItem(s, 'ice', 1); store.changed();
  });
  await page.waitForSelector('#shop:not(.hidden)');
  await band(true); await skip(500);
  cursor = { x: 1400, y: 300, show: true, down: false };
  caption('Arrange your cart. Unlock combos.', 296);
  await hold(14);
  const card = await page.evaluate(() => { const c = [...document.querySelectorAll('.card[data-offer]')].find((e) => !e.classList.contains('sold') && !e.classList.contains('blocked')); return c ? `.card[data-offer="${c.dataset.offer}"]` : null; });
  if (card) { await clickAt(card, 26); mark('buy'); }
  // the Ice Pack (1x2) goes under the Vacuum (cols 5-6, rows 0-1) at col 5, rows 2-3
  const cellSel = (x, y) => `.cell[data-cx="${x}"][data-cy="${y}"]`;
  const iceSel = await page.evaluate(() => `.slot[data-slot="${window.__gg.store.state.inventory.shelf.findIndex((i) => i?.type === 'ice')}"] .item`);
  const iceC = await center(iceSel);
  await moveTo(iceC.x, iceC.y, 30);
  cursor.down = true; await page.mouse.down(); await hold(5);
  const dst = await center(cellSel(5, 2));
  const dst2 = await center(cellSel(5, 3));
  const to = { x: dst.x, y: (dst.y + dst2.y) / 2 };
  await moveTo(iceC.x + 25, iceC.y + 20, 6);
  await moveTo(to.x, to.y, 34);
  await hold(8);
  await page.evaluate(() => { const rm = Element.prototype.remove; window.__rmToast = () => document.querySelectorAll('.celebrate').forEach((e) => rm.call(e)); Element.prototype.remove = function () { if (!this.classList?.contains('celebrate')) rm.call(this); }; }); // the toast's fake-clock timeout fires early; the CSS animation fades it out itself
  await page.mouse.up(); cursor.down = false; mark('upgrade'); // combo celebration plays
  for (let i = 0; i < 60; i++) { await frame(); if (process.env.DEBUG && i % 6 === 0) console.log(i, await page.evaluate(() => [document.querySelectorAll('.celebrate').length, document.getAnimations().map((a) => Math.round(a.currentTime) + '/' + a.playState).join(' ')])); }
  console.log('after drop', await page.evaluate(() => window.__gg.store.state.build.recipes.map((r) => r.id)));
  await hold(Math.max(0, 840 - n));
  await page.evaluate(() => window.__rmToast());
  console.log('shop done at frame', n);
  if (process.env.STOP === 'shop') { await browser.close(); return; }

  // 5. Route (14-16 s)
  await page.evaluate(() => {
    const { store, rules } = window.__gg; const s = store.state;
    s.money = Math.max(s.money, 30);
  });
  await clickAt('[data-act="next"]', 18);
  await page.evaluate(() => {
    const { store } = window.__gg; const s = store.state;
    s.doors = ['rush', 'event', 'clearance'];
    document.getElementById('route').classList.add('hidden'); store.changed();
  });
  cursor.show = true;
  caption('Choose your risk', 112);
  await skip(200); // let the entrance animations (frozen at t0) start from the first captured frame
  await hold(10);
  await clickAt('[data-act="door"][data-id="event"]', 36);
  mark('click');
  await hold(Math.max(0, 960 - n));
  cursor.show = false;
  console.log('route done at frame', n);

  await band(false); await skip(400);
  // 6. Montage (16-24 s), five ~1.6 s clips
  const clips = [
    { dept: 'frozen', wave: 5, cap: '5 themed departments' },
    { dept: 'bakery', wave: 6, cap: '5 themed departments' },
    { dept: 'checkout', wave: 5, cap: '5 themed departments' },
    { dept: 'electronics', wave: 6, event: 'outage', cap: 'Power outages, wet floors and more' },
    { dept: 'main', wave: 6, event: 'wetFloor', cap: 'Power outages, wet floors and more' },
  ];
  for (const c of clips) {
    await page.evaluate(JUMP, { dept: c.dept, wave: c.wave, event: c.event ?? 'none' });
    await skip(300);
    await page.evaluate(POPULATE, { time: 20, event: c.event, extra: false });
    await skip(c.event ? 1500 : 1300);
    cap = { text: c.cap, from: cap && cap.text === c.cap ? cap.from : n, to: cap && cap.text === c.cap ? cap.to : n + (c.cap.startsWith('5') ? 3 * 96 : 2 * 96) };
    await hold(96);
  }
  console.log('montage done at frame', n);

  // 7. Boss (24-28.5 s)
  caption('Take down the Store Manager', 262);
  await band(true);
  await page.evaluate(() => { window.__center = { x: 640, y: 250 }; });
  await page.evaluate(JUMP, { dept: 'boss', wave: 8, event: 'none' });
  await skip(300);
  await skip(1500);
  for (let i = 0; i < 270; i++) { if (i === 40 || i === 150) mark('shove'); await frame(); }
  console.log('boss done at frame', n, await page.evaluate(() => ({ hp: window.__gg.store.state.hp, phase: window.__gg.store.state.phase })));

  await band(false);
  // 8. End card (28.5-30 s)
  cap = null;
  for (let i = 0; i < 90; i++) {
    const u = Math.min(1, i / 14), e = 1 - (1 - u) ** 3;
    endcard = { scale: 0.86 + 0.14 * e, opacity: Math.min(1, i / 6) };
    await frame();
  }
  console.log('total frames', n);
  await browser.close();
  writeFileSync(join(FRAMES, 'sfx.json'), JSON.stringify(sfx));
}

// ───────────────────────── audio + encode ─────────────────────────
function encode() {
  const A = (f) => join(ROOT, 'public/assets/audio', f);
  const events = JSON.parse(readFileSync(join(FRAMES, 'sfx.json'), 'utf8'));
  const vol = { click: 0.7, shove: 0.8, buy: 0.8, upgrade: 0.9 };
  const file = { click: 'click.wav', shove: 'shove.wav', buy: 'buy.wav', upgrade: 'upgrade.wav' };
  const inputs = ['-i', A('music_main.wav'), '-i', A('music_boss.wav')];
  const fx = [
    '[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:25.5,afade=t=out:st=23.5:d=2,asetpts=PTS-STARTPTS[m0]',
    '[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:6,afade=t=in:d=0.8,afade=t=out:st=4.2:d=1.8,adelay=24000|24000[m1]',
  ];
  const labels = ['[m0]', '[m1]'];
  events.forEach((e, i) => {
    if (!file[e.name]) return;
    inputs.push('-i', A(file[e.name]));
    const ms = Math.round(e.t * 1000);
    fx.push(`[${inputs.filter((x) => x === '-i').length}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${vol[e.name]},adelay=${ms}|${ms}[s${i}]`);
    labels.push(`[s${i}]`);
  });
  fx.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,atrim=0:30,afade=t=out:st=28.4:d=1.6,loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,alimiter=limit=0.8:level=disabled,atrim=0:30[a]`);
  const mp4 = join(OUT, 'goblin-grocery-trailer.mp4');
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FRAMES, '%05d.jpg'), ...inputs,
    '-filter_complex', fx.join(';'), '-map', '0:v', '-map', '[a]',
    '-vf', 'scale=in_range=pc:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '16', '-preset', 'slow', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', '30', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  console.log('wrote', mp4);
}

if (!SKIP_CAPTURE) await capture();
encode();
