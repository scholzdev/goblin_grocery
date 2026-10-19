// Pure placement for the tutorial bubble (no DOM): try each side of the anchor in order and take the first spot inside the view
// that covers neither the anchor nor anything in `avoid`; if none is clear, the one that covers the least.
export interface Rect { x: number; y: number; w: number; h: number }
/** Where the bubble sits relative to the anchor. */
export type Side = 'above' | 'below' | 'left' | 'right';
export const GAP = 16;
const MARGIN = 8;
/** Hiding the thing the callout points at is worse than hiding its neighbours. */
const ANCHOR_WEIGHT = 10;
const SIDES: Side[] = ['below', 'above', 'right', 'left'];

const overlap = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const clamp = (v: number, size: number, max: number): number => Math.min(Math.max(v, MARGIN), Math.max(max - size - MARGIN, MARGIN));

export function placeBubble(size: { w: number; h: number }, view: { w: number; h: number }, anchor: Rect, avoid: Rect[], prefer: Side[]): { x: number; y: number; side: Side } {
  const { w, h } = size;
  const cx = anchor.x + anchor.w / 2 - w / 2, cy = anchor.y + anchor.h / 2 - h / 2;
  const at: Record<Side, [number, number]> = {
    above: [cx, anchor.y - h - GAP],
    below: [cx, anchor.y + anchor.h + GAP],
    left: [anchor.x - w - GAP, cy],
    right: [anchor.x + anchor.w + GAP, cy],
  };
  let best: { x: number; y: number; side: Side } | undefined, bestCost = Infinity;
  for (const side of new Set([...prefer, ...SIDES])) {
    const x = clamp(at[side][0], w, view.w), y = clamp(at[side][1], h, view.h);
    const box = { x, y, w, h };
    const cost = avoid.reduce((n, r) => n + overlap(box, r), ANCHOR_WEIGHT * overlap(box, anchor));
    if (cost < bestCost) { best = { x, y, side }; bestCost = cost; }
    if (cost === 0) break;
  }
  return best!;
}
