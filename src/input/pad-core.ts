// Gamepad maths with no DOM or Gamepad API access, so it can be unit-tested (see tests/gamepad.test.ts).
import type { Phase } from '../types';

export interface Vec { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Box { left: number; top: number; width: number; height: number }

export const DEADZONE = 0.25;

/** Standard-mapping button indices. */
export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export type PadMode = 'combat' | 'shop' | 'menu';

/** What the pad drives: the goblin, the shop cursor, or DOM focus in menus. A pick `dialog` over the fight (stockroom, mini-boss crates) is a menu. */
export function padMode(phase: Phase, paused: boolean, dialog: boolean): PadMode {
  return phase === 'shop' ? 'shop' : (phase === 'combat' || phase === 'checkout') && !paused && !dialog ? 'combat' : 'menu';
}

/**
 * Whether A may confirm this frame; called every frame with the pad's mode. A is also the shove, so for `grace` ms after the pad leaves
 * the fight (a pick dialog, the shop, a pause) it confirms nothing: a player still mashing shove does not take whatever has focus.
 */
export function makeConfirmGate(grace = 400): (mode: PadMode, now: number) => boolean {
  let prev: PadMode | null = null;
  let until = -Infinity;
  return (mode, now) => {
    if (prev === 'combat' && mode !== 'combat') until = now + grace;
    prev = mode;
    return now >= until;
  };
}

const len = (v: Vec): number => Math.hypot(v.x, v.y);

/** Clamps a vector to length 1. */
export function clampLength(v: Vec): Vec {
  const l = len(v);
  return l > 1 ? { x: v.x / l, y: v.y / l } : v;
}

/** Radial deadzone: inside it nothing moves, outside the magnitude is rescaled so it ramps up from 0 at the edge to 1 at full tilt. */
export function stickVector(x: number, y: number, deadzone = DEADZONE): Vec {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const l = Math.hypot(x, y);
  if (l <= deadzone) return { x: 0, y: 0 };
  const mag = Math.min(1, (l - deadzone) / (1 - deadzone));
  return { x: (x / l) * mag, y: (y / l) * mag };
}

/** D-pad buttons as a vector; diagonals have length 1. */
export function dpadVector(up: boolean, down: boolean, left: boolean, right: boolean): Vec {
  return clampLength({ x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) });
}

/** Adds input sources together (stick + d-pad + keyboard) without ever exceeding full speed. */
export const mergeVectors = (...vs: Vec[]): Vec => clampLength(vs.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y }), { x: 0, y: 0 }));

/** Menu direction from a stick: the dominant axis once the stick is pushed past `threshold`. */
export function stickDir(x: number, y: number, threshold = 0.55): Dir | null {
  if (Math.hypot(x, y) < threshold) return null;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
}

/** Indices of buttons that went from released to pressed. */
export function pressedEdges(prev: readonly boolean[], cur: readonly boolean[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < cur.length; i++) if (cur[i] && !prev[i]) out.push(i);
  return out;
}

/** Held-direction repeat: fires at once, then after `first` ms, then every `every` ms. Returns the direction to act on, or null. */
export function makeRepeater(first = 380, every = 120): (dir: Dir | null, now: number) => Dir | null {
  let cur: Dir | null = null;
  let at = 0;
  return (dir, now) => {
    if (!dir) { cur = null; return null; }
    if (dir !== cur) { cur = dir; at = now + first; return dir; }
    if (now >= at) { at = now + every; return dir; }
    return null;
  };
}

/**
 * Spatial focus: from `boxes[from]`, the index of the best box lying in direction `dir` (nearest along the axis, penalising sideways
 * offset), or -1. Boxes outside a ~63 degree cone are only used when nothing lies inside it.
 */
export function pickNext(boxes: readonly Box[], from: number, dir: Dir): number {
  const f = boxes[from];
  if (!f) return -1;
  const cx = f.left + f.width / 2, cy = f.top + f.height / 2;
  let best = -1, bestScore = Infinity, bestOut = -1, bestOutScore = Infinity;
  boxes.forEach((b, i) => {
    if (i === from) return;
    const dx = b.left + b.width / 2 - cx, dy = b.top + b.height / 2 - cy;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const side = Math.abs(dir === 'left' || dir === 'right' ? dy : dx);
    if (along < 1) return;
    const score = along + 2 * side;
    if (side <= along * 2) { if (score < bestScore) { bestScore = score; best = i; } } else if (score < bestOutScore) { bestOutScore = score; bestOut = i; }
  });
  return best >= 0 ? best : bestOut;
}
