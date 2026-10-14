// Pure geometry for aisle obstacles. Rects are ground footprints given by their centre (x, y) and size (w, h).
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

/** Box (min/max) of a centre-based rect grown by `pad`. */
const box = (r: Rect, pad = 0) => ({ l: r.x - r.w / 2 - pad, r: r.x + r.w / 2 + pad, t: r.y - r.h / 2 - pad, b: r.y + r.h / 2 + pad });

/** Push (x, y) out of the open box along the axis with the smallest penetration. Returns null when already outside. */
function ejectBox(x: number, y: number, bx: ReturnType<typeof box>): Pt | null {
  if (x <= bx.l || x >= bx.r || y <= bx.t || y >= bx.b) return null;
  const dl = x - bx.l, dr = bx.r - x, dt = y - bx.t, db = bx.b - y, m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: bx.l, y };
  if (m === dr) return { x: bx.r, y };
  return m === dt ? { x, y: bx.t } : { x, y: bx.b };
}

/** Circle vs rect: returns the corrected centre, or null when not overlapping. */
export function pushOutCircle(x: number, y: number, radius: number, rect: Rect): Pt | null {
  const bx = box(rect);
  const cx = Math.max(bx.l, Math.min(x, bx.r)), cy = Math.max(bx.t, Math.min(y, bx.b));
  const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return null;
  if (d2 === 0) return ejectBox(x, y, box(rect, radius)) ?? { x: x + radius, y };
  const d = Math.sqrt(d2);
  return { x: cx + (dx / d) * radius, y: cy + (dy / d) * radius };
}

/**
 * Horizontal capsule (the goblin + cart) vs rect. The capsule spans x + minOff .. x + maxOff at height y with radius `radius`;
 * returns the corrected centre or null. Corners are treated as square (slightly generous), which keeps sliding smooth.
 */
export function pushOutCapsule(x: number, y: number, minOff: number, maxOff: number, radius: number, rect: Rect): Pt | null {
  const b = box(rect, radius);
  return ejectBox(x, y, { l: b.l - maxOff, r: b.r - minOff, t: b.t, b: b.b });
}

/** Does the segment (x0,y0)-(x1,y1) cross the rect grown by `pad`? Touching the border does not count. */
export function segmentHitsRect(x0: number, y0: number, x1: number, y1: number, rect: Rect, pad = 0): boolean {
  const b = box(rect, pad);
  let t0 = 0, t1 = 1;
  for (const [p, q, lo, hi] of [[x0, x1 - x0, b.l, b.r], [y0, y1 - y0, b.t, b.b]]) {
    if (q === 0) { if (p <= lo || p >= hi) return false; continue; }
    let a = (lo - p) / q, c = (hi - p) / q;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 >= t1) return false;
  }
  return true;
}

/**
 * Direction for a chaser at (x, y) heading to (tx, ty): straight when the way is clear, otherwise towards the corner of the
 * blocking rect (grown by radius) that gives the shortest detour. Returns a unit vector.
 */
export function steerAround(x: number, y: number, tx: number, ty: number, radius: number, rects: readonly Rect[]): Pt {
  let dx = tx - x, dy = ty - y;
  const hit = rects.find((r) => segmentHitsRect(x, y, tx, ty, r, radius));
  if (hit) {
    const b = box(hit, radius + 6);
    let best = Infinity;
    for (const c of [[b.l, b.t], [b.r, b.t], [b.l, b.b], [b.r, b.b]]) {
      const cost = Math.hypot(c[0] - x, c[1] - y) + Math.hypot(tx - c[0], ty - c[1]);
      if (cost < best) { best = cost; dx = c[0] - x; dy = c[1] - y; }
    }
  }
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}
