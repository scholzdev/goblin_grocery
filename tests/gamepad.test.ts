import { describe, expect, it } from 'vitest';
import { DEADZONE, clampLength, dpadVector, makeConfirmGate, makeRepeater, mergeVectors, padMode, pickNext, pressedEdges, stickDir, stickVector } from '../src/input/pad-core';

describe('gamepad stick mapping', () => {
  it('ignores drift inside the deadzone', () => {
    expect(stickVector(0.2, 0.1)).toEqual({ x: 0, y: 0 });
    expect(stickVector(DEADZONE, 0)).toEqual({ x: 0, y: 0 });
  });

  it('ramps up from zero at the deadzone edge to one at full tilt', () => {
    const small = stickVector(0.4, 0);
    expect(small.x).toBeGreaterThan(0);
    expect(small.x).toBeLessThan(0.3);
    expect(stickVector(1, 0)).toEqual({ x: 1, y: 0 });
  });

  it('keeps direction and never exceeds length 1 (square gate corners)', () => {
    const v = stickVector(1, 1);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(v.y);
    const d = stickVector(-0.9, 0.3);
    expect(Math.sign(d.x)).toBe(-1);
    expect(Math.sign(d.y)).toBe(1);
  });

  it('treats bad axis values as centred', () => {
    expect(stickVector(NaN, 1)).toEqual({ x: 0, y: 0 });
  });

  it('d-pad diagonals are normalised, opposites cancel', () => {
    const v = dpadVector(true, false, false, true);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.y).toBeLessThan(0);
    expect(dpadVector(true, true, false, false)).toEqual({ x: 0, y: 0 });
  });

  it('merging sources clamps to full speed', () => {
    const m = mergeVectors({ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(1);
    expect(mergeVectors({ x: 0.2, y: 0 }, { x: 0.3, y: 0 })).toEqual({ x: 0.5, y: 0 });
    expect(clampLength({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('gamepad menu helpers', () => {
  it('stickDir picks the dominant axis past the threshold', () => {
    expect(stickDir(0.2, 0.2)).toBeNull();
    expect(stickDir(0.9, 0.3)).toBe('right');
    expect(stickDir(-0.2, -0.8)).toBe('up');
    expect(stickDir(0.1, 0.9)).toBe('down');
  });

  it('pressedEdges reports only new presses', () => {
    expect(pressedEdges([false, true, false], [true, true, true])).toEqual([0, 2]);
    expect(pressedEdges([], [false, true])).toEqual([1]);
  });

  it('repeater fires immediately, waits, then repeats', () => {
    const r = makeRepeater(300, 100);
    expect(r('down', 0)).toBe('down');
    expect(r('down', 100)).toBeNull();
    expect(r('down', 300)).toBe('down');
    expect(r('down', 350)).toBeNull();
    expect(r('down', 400)).toBe('down');
    expect(r(null, 410)).toBeNull();
    expect(r('down', 420)).toBe('down'); // released and pressed again: immediate
    expect(r('left', 430)).toBe('left'); // new direction: immediate
  });

  it('pickNext moves focus through a grid and falls back outside the cone', () => {
    const cell = (c: number, r: number) => ({ left: c * 100, top: r * 100, width: 90, height: 90 });
    const boxes = [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)];
    expect(pickNext(boxes, 0, 'right')).toBe(1);
    expect(pickNext(boxes, 0, 'down')).toBe(2);
    expect(pickNext(boxes, 3, 'up')).toBe(1);
    expect(pickNext(boxes, 0, 'left')).toBe(-1);
    expect(pickNext(boxes, 0, 'up')).toBe(-1);
    const wide = [{ left: 0, top: 0, width: 40, height: 40 }, { left: 20, top: 400, width: 40, height: 40 }];
    expect(pickNext(wide, 0, 'down')).toBe(1);
    expect(pickNext(wide, 0, 'right')).toBe(1); // outside the cone but the only thing to the right
    expect(pickNext(wide, 0, 'left')).toBe(-1);
  });
});

describe('what the pad drives', () => {
  it('a pick dialog over the fight (stockroom, mini-boss crates) takes the pad like a menu', () => {
    expect(padMode('combat', false, false)).toBe('combat');
    expect(padMode('combat', false, true)).toBe('menu');
  });

  it('the shop keeps its cursor and a pause is a menu, dialog or not', () => {
    expect(padMode('shop', false, false)).toBe('shop');
    expect(padMode('combat', true, false)).toBe('menu');
    expect(padMode('combat', true, true)).toBe('menu');
    expect(padMode('checkout', false, false)).toBe('combat');
  });
});

describe('A right after the fight', () => {
  it('confirms nothing for a moment when a pick dialog takes the pad, so a shove mash cannot take the first card', () => {
    const gate = makeConfirmGate();
    expect(gate('combat', 0)).toBe(true);
    expect(gate('menu', 1000), 'the crates just opened').toBe(false);
    expect(gate('menu', 1399)).toBe(false);
    expect(gate('menu', 1400)).toBe(true);
  });

  it('holds back the shop the same way, and leaves menus that were not reached from the fight alone', () => {
    const gate = makeConfirmGate();
    expect(gate('menu', 0), 'title screen').toBe(true);
    expect(gate('combat', 100)).toBe(true);
    expect(gate('shop', 2000)).toBe(false);
    expect(gate('shop', 2400)).toBe(true);
    expect(gate('menu', 2500), 'shop to route screen').toBe(true);
  });
});
