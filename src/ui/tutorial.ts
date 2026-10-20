import { store } from '../state/store';
import { settings, saveSettings } from '../state/settings';
import { flow } from '../flow';
import { mergeTargetFor } from '../state/run';
import { BOSS_WAVE } from '../data/waves';
import { ITEMS } from '../data/items';
import { t } from '../i18n';
import { matches } from '../state/keymap';
import { isDown } from '../input/keyboard';
import { padMove, padShoves } from '../input/gamepad';
import { keyVars } from './keys';
import { placeBubble, type Rect, type Side } from './tutorial-place';
import { advance, freshProgress, pick, skipAll, type Progress, type Snap } from './tutorial-core';

// First-run tutorial: speech-bubble callouts that never block the game. The bubble ignores the pointer (only "Skip" takes clicks),
// never pauses combat and advances by itself when the player does the thing. All logic lives in tutorial-core.ts.
interface Target { anchor: string; avoid?: string[]; prefer: Side[] }
const COMBAT: Target = { anchor: '#hud', prefer: ['below'] };
const SHOP_GRID: Target = { anchor: '#shop .grid-wrap', prefer: ['above', 'below', 'right'] };
// Where each callout points and what it must leave uncovered. Combat ones hang under the HUD strip, the route one under the doors.
const TARGET: Record<string, Target> = {
  buy: { anchor: '#shop .offers', avoid: ['#shop .offers-head', '#shop .grid-wrap'], prefer: ['below', 'above', 'left'] },
  place: SHOP_GRID,
  merge: SHOP_GRID,
  combos: { anchor: '#shop .combos', avoid: ['#shop .grid-wrap'], prefer: ['below', 'above', 'left'] },
  door: { anchor: '.route .doors', avoid: ['.route .door', '.route h2', '.route .progress'], prefer: ['below', 'above'] },
};
const TICK = 150;

let ui: HTMLElement;
let el: HTMLElement;
let shown: string | null = null;
let shownMs = 0;
let shownMoney = 0;
let rendered = '';
let moveMs = 0;
let dashes = 0;
let padDashBase = 0;
let flags: string[] = [];

// Progress is read from the settings every time: other modules add their own ids to `tutorialSeen` (state/disclosure.ts).
const progress = (): Progress => ({ done: settings.tutorialDone, seen: settings.tutorialSeen });
const save = (p: Progress): void => {
  settings.tutorialDone = p.done;
  settings.tutorialSeen = p.seen;
  saveSettings();
};

/** Settings → "Replay tutorial". */
export function resetTutorial(): void {
  save(freshProgress(settings.tutorialSeen));
}

export function initTutorial(root: HTMLElement): void {
  ui = root;
  el = document.createElement('div');
  el.id = 'tutorial';
  el.className = 'hidden';
  el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.skip')) save(skipAll(settings.tutorialSeen)); });
  ui.append(el);
  window.addEventListener('keydown', (e) => {
    if (matches(settings.keys, 'shove', e.code) && !e.repeat && !flow.paused && store.state.phase === 'combat') dashes++;
  });
  store.on('run-start', () => { moveMs = 0; dashes = 0; padDashBase = padShoves(); flags = []; });
  store.on('shop-open', () => { flags = []; });
  for (const f of ['elite', 'obstacles', 'event']) store.on(`tut:${f}`, () => { if (!flags.includes(f)) flags.push(f); });
  setInterval(tick, TICK);
}

function snap(): Snap {
  const s = store.state;
  const inv = s.inventory;
  const all = [...inv.placed, ...inv.shelf];
  return {
    lab: !!s.lab,
    phase: s.phase,
    shown,
    ms: shownMs,
    kills: s.stats.kills,
    moved: moveMs >= 600,
    dashed: dashes + padShoves() - padDashBase > 0,
    moneyUp: s.money > shownMoney,
    bought: !!s.shop?.offers.some((o) => o.sold),
    supported: s.build.weapons.some((w) => s.build.adjacency.some((p) => p.includes(w.uid))),
    mergePair: all.some((i) => i && !ITEMS[i.type].legendary && mergeTargetFor(inv, i.type, i.tier ?? 1, i)),
    boss: s.wave === BOSS_WAVE && !s.overtime && s.phase === 'combat',
    flags,
  };
}

function tick(): void {
  if (!store.state) return;
  const paused = flow.paused;
  if (!paused && store.state.phase === 'combat' && (isDown('up') || isDown('down') || isDown('left') || isDown('right') || padMove().x !== 0 || padMove().y !== 0)) moveMs += TICK;
  const before = snap();
  const prog = progress();
  const cur = advance(prog, before);
  if (cur !== prog) save(cur);
  const pk = pick(cur, before);
  const next = pk?.id ?? null;
  if (next !== shown) {
    shown = next;
    shownMs = 0;
    shownMoney = store.state.money;
  } else if (!paused) shownMs += TICK;
  render(pk);
}

function render(pk: { id: string; tip: boolean } | null): void {
  el.classList.toggle('hidden', !pk);
  if (!pk) { rendered = ''; return; }
  const { id, tip: isTip } = pk;
  const key = `${isTip ? 'tip' : 'tut'}${id[0].toUpperCase()}${id.slice(1)}` as Parameters<typeof t>[0];
  const sig = `${key}|${settings.language}|${JSON.stringify(settings.keys)}`;
  if (sig !== rendered) {
    rendered = sig;
    el.innerHTML = `${t(key, keyVars())}<button class="skip">${t('tutSkip')}</button>`;
    el.classList.toggle('tip', isTip);
  }
  place(TARGET[id] ?? COMBAT);
}

/** Rects in the ui root's design units (the root is scaled, getBoundingClientRect is not). */
function place(tg: Target): void {
  const sc = ui.getBoundingClientRect().width / ui.offsetWidth || 1;
  const r = ui.getBoundingClientRect();
  const rect = (e: Element): Rect => { const b = e.getBoundingClientRect(); return { x: (b.left - r.left) / sc, y: (b.top - r.top) / sc, w: b.width / sc, h: b.height / sc }; };
  const a = document.querySelector(tg.anchor);
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!a) { el.classList.remove('lside', 'rside'); el.classList.add('below'); el.style.setProperty('--ax', '50%'); el.style.left = `${(ui.offsetWidth - w) / 2}px`; el.style.top = '96px'; return; }
  const avoid = (tg.avoid ?? []).flatMap((q) => [...document.querySelectorAll(q)].map(rect));
  const ar = rect(a);
  const p = placeBubble({ w, h }, { w: ui.offsetWidth, h: ui.offsetHeight }, ar, avoid, tg.prefer);
  el.classList.toggle('below', p.side === 'below');
  el.classList.toggle('lside', p.side === 'left');
  el.classList.toggle('rside', p.side === 'right');
  el.style.setProperty('--ax', `${Math.min(Math.max(ar.x + ar.w / 2 - p.x, 20), w - 20)}px`);
  el.style.setProperty('--ay', `${Math.min(Math.max(ar.y + ar.h / 2 - p.y, 20), h - 20)}px`);
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
}
