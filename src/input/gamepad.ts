// Gamepad support on the browser Gamepad API (standard mapping). Nothing runs until a pad reports in:
// no listeners besides connect/disconnect and no polling loop while no controller is attached.
// Combat feeds padMove()/takePadShove() to the arena; menus get DOM focus navigation; the shop gets a cursor (ShopPad in shop.ts).
import { BTN, makeRepeater, mergeVectors, pickNext, pressedEdges, stickDir, stickVector, dpadVector, type Dir, type Vec } from './pad-core';

export interface ShopPad {
  /** Moves the cursor one target in `dir`. */
  move(dir: Dir): void;
  /** A: buy / pick up / drop / press the button under the cursor. */
  confirm(): void;
  /** B: cancel the held item, else clear the selection. */
  cancel(): void;
  /** LB / RB / X: rotate the held item. */
  rotate(): void;
  /** Y: open the inspector for the item under the cursor. */
  inspect(): void;
  /** Called when the shop becomes the active pad context so the cursor has a home. */
  enter(): void;
}

export interface PadHooks {
  mode(): 'combat' | 'shop' | 'menu';
  /** The element menu focus is confined to (topmost modal or visible screen), or null. */
  scope(): HTMLElement | null;
  /** Start: pause / resume. */
  pause(): void;
  /** Y / Select: the loadout view (same as the Tab key). */
  loadout(): void;
  /** B in menus: the same code path as Escape (close modal, leave screen, resume). */
  back(): void;
  /** The pad vanished while it was connected; the game pauses itself if it was mid-fight. */
  lost(): void;
  shop: ShopPad;
}

const ZERO: Vec = { x: 0, y: 0 };
const FOCUSABLE = 'button:not([disabled]), summary, [data-act]:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let hooks: PadHooks | null = null;
let raf = 0;
let move: Vec = ZERO;
let shoveQueued = false;
let shoveCount = 0;
let prev: boolean[] = [];
let prevMode: ReturnType<PadHooks['mode']> | '' = '';
const repeat = makeRepeater();

/** Current analog movement for combat: left stick + d-pad, deadzoned, length at most 1. Zero when no pad is in play. */
export const padMove = (): Vec => move;
/** True once per A press in combat. */
export function takePadShove(): boolean {
  const s = shoveQueued;
  shoveQueued = false;
  return s;
}
/** Total shoves requested by the pad so far (the tutorial watches this). */
export const padShoves = (): number => shoveCount;

export function initGamepad(h: PadHooks): void {
  hooks = h;
  window.addEventListener('gamepadconnected', start);
  window.addEventListener('gamepaddisconnected', () => { /* the loop notices on its next frame */ });
  start(); // a pad that was already pressed before the page loaded is listed right away
}

function activePad(): Gamepad | null {
  const list = navigator.getGamepads?.() ?? [];
  for (const p of list) if (p && p.connected) return p;
  return null;
}

function start(): void {
  if (raf || !activePad()) return;
  prev = [];
  prevMode = '';
  raf = requestAnimationFrame(frame);
  window.addEventListener('pointermove', leavePadNav);
  window.addEventListener('keydown', leavePadNav, true);
}

function stop(): void {
  raf = 0;
  move = ZERO;
  shoveQueued = false;
  window.removeEventListener('pointermove', leavePadNav);
  window.removeEventListener('keydown', leavePadNav, true);
  document.body.classList.remove('pad-nav');
}

const leavePadNav = (): void => { document.body.classList.remove('pad-nav'); };

function frame(now: number): void {
  const pad = activePad();
  if (!pad || !hooks) {
    const had = prev.length > 0;
    stop();
    if (had) hooks?.lost();
    return;
  }
  raf = requestAnimationFrame(frame);
  const h = hooks;
  const down = pad.buttons.map((b) => b.pressed || b.value > 0.6);
  const first = prev.length === 0; // swallow the held state at connect so nothing fires by itself
  const edges = first ? [] : pressedEdges(prev, down);
  prev = down;
  const mode = h.mode();
  const changed = mode !== prevMode;
  prevMode = mode;

  const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
  const dp = dpadVector(down[BTN.UP], down[BTN.DOWN], down[BTN.LEFT], down[BTN.RIGHT]);
  move = mode === 'combat' ? mergeVectors(stickVector(ax, ay), dp) : ZERO;

  if (edges.includes(BTN.START)) h.pause();
  if ((edges.includes(BTN.Y) && mode === 'combat') || edges.includes(BTN.SELECT)) h.loadout();

  if (mode === 'combat') {
    if (edges.includes(BTN.A)) { shoveQueued = true; shoveCount++; }
    return;
  }
  const dir = repeat(dpadDir(down) ?? stickDir(ax, ay), now);
  if (mode === 'shop') {
    if (changed) h.shop.enter();
    if (dir) h.shop.move(dir);
    for (const e of edges) {
      if (e === BTN.A) h.shop.confirm();
      else if (e === BTN.B) h.shop.cancel();
      else if (e === BTN.X || e === BTN.LB || e === BTN.RB) h.shop.rotate();
      else if (e === BTN.Y) h.shop.inspect();
    }
    return;
  }
  if (dir) navigate(dir);
  for (const e of edges) {
    if (e === BTN.A) activate();
    else if (e === BTN.B) h.back();
    else if (e === BTN.Y) h.loadout();
  }
}

function dpadDir(down: boolean[]): Dir | null {
  return down[BTN.UP] ? 'up' : down[BTN.DOWN] ? 'down' : down[BTN.LEFT] ? 'left' : down[BTN.RIGHT] ? 'right' : null;
}

// ───────────────────────────── menu focus ─────────────────────────────

const visible = (el: HTMLElement): boolean => !el.closest('.hidden') && el.getClientRects().length > 0;

function focusables(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

function focusEl(el: HTMLElement): void {
  document.body.classList.add('pad-nav');
  if (!el.matches('button, input, select, textarea, [tabindex]')) el.tabIndex = -1;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function navigate(dir: Dir): void {
  const scope = hooks?.scope();
  if (!scope) return;
  const list = focusables(scope);
  if (!list.length) return;
  const cur = list.indexOf(document.activeElement as HTMLElement);
  if (cur < 0) { focusEl(list.find((e) => e.hasAttribute('data-focus')) ?? list[0]); return; }
  const el = list[cur];
  if (el instanceof HTMLInputElement && el.type === 'range' && (dir === 'left' || dir === 'right')) { // sliders: left/right change the value
    el.value = String(Number(el.value) + (dir === 'right' ? 5 : -5));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const next = pickNext(list.map((e) => e.getBoundingClientRect()), cur, dir);
  if (next >= 0) focusEl(list[next]);
}

function activate(): void {
  const scope = hooks?.scope();
  const el = document.activeElement as HTMLElement | null;
  if (!scope || !el || !scope.contains(el)) {
    const list = scope ? focusables(scope) : [];
    if (list.length) focusEl(list.find((e) => e.hasAttribute('data-focus')) ?? list[0]);
    return;
  }
  if (el instanceof HTMLSelectElement) { // cycle the options
    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (!(el instanceof HTMLInputElement && el.type === 'range')) el.click();
}
