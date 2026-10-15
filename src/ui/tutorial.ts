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
import { advance, freshProgress, pick, skipAll, type Progress, type Snap } from './tutorial-core';

// First-run tutorial: speech-bubble callouts that never block the game. The bubble ignores the pointer (only "Skip" takes clicks),
// never pauses combat and advances by itself when the player does the thing. All logic lives in tutorial-core.ts.
const ANCHOR: Record<string, string> = { buy: '#shop .offers', place: '#shop .grid-wrap', merge: '#shop .grid-wrap', combos: '#shop .combos' };
const TICK = 150;

let ui: HTMLElement;
let el: HTMLElement;
let prog: Progress = { done: settings.tutorialDone, seen: settings.tutorialSeen };
let shown: string | null = null;
let shownMs = 0;
let shownMoney = 0;
let rendered = '';
let moveMs = 0;
let dashes = 0;
let padDashBase = 0;
let flags: string[] = [];

const save = (p: Progress): void => {
  prog = p;
  settings.tutorialDone = p.done;
  settings.tutorialSeen = p.seen;
  saveSettings();
};

/** Settings → "Replay tutorial". */
export function resetTutorial(): void {
  save(freshProgress());
}

export function initTutorial(root: HTMLElement): void {
  ui = root;
  el = document.createElement('div');
  el.id = 'tutorial';
  el.className = 'hidden';
  el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.skip')) save(skipAll()); });
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
  const cur = advance(prog, before);
  if (cur !== prog) save(cur);
  const pk = pick(prog, before);
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
  place(ANCHOR[id], id === 'door' ? 680 : 96);
}

/** Combat callouts sit under the HUD strip, the route one below the doors; shop callouts hang above (or below) the element they talk about. */
function place(sel: string | undefined, top: number): void {
  const sc = ui.getBoundingClientRect().width / ui.offsetWidth || 1;
  const w = el.offsetWidth, h = el.offsetHeight, uw = ui.offsetWidth;
  const a = sel ? document.querySelector(sel)?.getBoundingClientRect() : undefined;
  const r = ui.getBoundingClientRect();
  let x = (uw - w) / 2, y = top, below = true;
  if (a) {
    const ax = (a.left - r.left) / sc, ay = (a.top - r.top) / sc, aw = a.width / sc, ah = a.height / sc;
    x = Math.min(Math.max(ax + aw / 2 - w / 2, 8), uw - w - 8);
    below = ay - h - 16 < 8;
    y = below ? ay + ah + 16 : ay - h - 16;
    el.style.setProperty('--ax', `${Math.min(Math.max(ax + aw / 2 - x, 20), w - 20)}px`);
  } else el.style.setProperty('--ax', '50%');
  el.classList.toggle('below', below);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}
