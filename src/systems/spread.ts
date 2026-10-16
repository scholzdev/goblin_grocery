// Pure layout helpers for placing a group of enemies (sims, lab sandbox). No Phaser, no rng: the caller picks the centre.

export type SpreadKind = 'random' | 'cluster' | 'ring';
export interface Pt { x: number; y: number }
export interface Box { left: number; right: number; top: number; bottom: number }

const GOLDEN_ANGLE = 2.399963229728653;
/** Default gap between neighbours of a cluster, and radius of a ring (world px). */
export const SPREAD = { spacing: 46, radius: 250 };

/** Point `i` of `n` for a `cluster` (tight sunflower spiral, point 0 on the centre) or a `ring` (even spacing, first point straight right). */
export function spreadPoint(kind: 'cluster' | 'ring', i: number, n: number, c: Pt, o: { spacing?: number; radius?: number } = {}): Pt {
  if (kind === 'ring') {
    const a = (Math.PI * 2 * i) / Math.max(1, n), r = o.radius ?? SPREAD.radius;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  }
  const r = (o.spacing ?? SPREAD.spacing) * Math.sqrt(i), a = i * GOLDEN_ANGLE;
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
}

export const spreadPoints = (kind: 'cluster' | 'ring', n: number, c: Pt, o: { spacing?: number; radius?: number } = {}): Pt[] =>
  Array.from({ length: n }, (_, i) => spreadPoint(kind, i, n, c, o));

/** `p` pulled inside `box` shrunk by `margin` on every side. */
export const clampPoint = (p: Pt, box: Box, margin = 0): Pt => ({
  x: Math.min(box.right - margin, Math.max(box.left + margin, p.x)),
  y: Math.min(box.bottom - margin, Math.max(box.top + margin, p.y)),
});
