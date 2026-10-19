import { describe, expect, it } from 'vitest';
import { placeBubble, type Rect } from '../src/ui/tutorial-place';

const SIZE = { w: 340, h: 70 };
const hit = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const box = (p: { x: number; y: number }): Rect => ({ x: p.x, y: p.y, w: SIZE.w, h: SIZE.h });

// Route screen as measured in the browser at 1280x800: title, progress dots, two ~310px cards, hint. The overlay is centred, so it moves down by half of any extra view height.
function route(vh: number) {
  const dy = (vh - 800) / 2;
  const doors: Rect[] = [{ x: 325, y: 285 + dy, w: 305, h: 345 }, { x: 650, y: 285 + dy, w: 300, h: 345 }];
  const row: Rect = { x: 325, y: 285 + dy, w: 625, h: 345 };
  const head: Rect[] = [{ x: 95, y: 140 + dy, w: 1090, h: 60 }, { x: 370, y: 212 + dy, w: 540, h: 46 }];
  return { row, doors, head };
}

describe('placeBubble', () => {
  for (const vh of [800, 960]) {
    it(`door step covers no card, title or progress at 1280x${vh}`, () => {
      const { row, doors, head } = route(vh);
      const p = placeBubble(SIZE, { w: 1280, h: vh }, row, [...doors, ...head], ['below', 'above']);
      expect(p.side).toBe('below');
      for (const r of [...doors, ...head]) expect(hit(box(p), r)).toBe(false);
    });
  }

  it('a fixed y of 680 (the old placement) covers the cards once the view is 960 high', () => {
    const { doors } = route(960);
    expect(doors.some((d) => hit({ x: 470, y: 680, w: SIZE.w, h: SIZE.h }, d))).toBe(true);
  });

  it('combos callout keeps the cart grid clear', () => {
    const grid: Rect = { x: 40, y: 150, w: 520, h: 420 };
    const combos: Rect = { x: 40, y: 590, w: 520, h: 120 };
    const p = placeBubble(SIZE, { w: 1280, h: 800 }, combos, [grid], ['above', 'below']);
    expect(hit(box(p), grid)).toBe(false);
    expect(hit(box(p), combos)).toBe(false);
  });

  it('keeps the bubble inside the view on both axes', () => {
    const p = placeBubble(SIZE, { w: 1280, h: 800 }, { x: 0, y: 0, w: 60, h: 30 }, [], ['above', 'left']);
    expect(p.x).toBeGreaterThanOrEqual(8);
    expect(p.y).toBeGreaterThanOrEqual(8);
    const q = placeBubble(SIZE, { w: 1280, h: 800 }, { x: 1230, y: 770, w: 50, h: 30 }, [], ['below', 'right']);
    expect(q.x + SIZE.w).toBeLessThanOrEqual(1272);
    expect(q.y + SIZE.h).toBeLessThanOrEqual(792);
  });

  it('takes the preferred side when it is free and reports it', () => {
    expect(placeBubble(SIZE, { w: 1280, h: 800 }, { x: 500, y: 400, w: 200, h: 100 }, [], ['above']).side).toBe('above');
  });

  it('falls back to the least overlap when nothing is clear', () => {
    const wall: Rect = { x: 0, y: 0, w: 1280, h: 800 };
    const p = placeBubble(SIZE, { w: 1280, h: 800 }, { x: 600, y: 300, w: 80, h: 80 }, [wall], ['below']);
    expect(p.side).toBe('below');
  });
});
