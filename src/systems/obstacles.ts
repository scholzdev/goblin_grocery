// Pure geometry for aisle obstacles. Rects are ground footprints given by their centre (x, y) and size (w, h).
export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

/** Whether two centre-based rects overlap once `a` is grown by `pad` on every side. */
export const rectsOverlap = (a: Rect, b: Rect, pad = 0): boolean =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + pad;

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

const unit = (dx: number, dy: number): Pt => {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

/**
 * Direction for a chaser at (x, y) heading to (tx, ty): straight when the way is clear, otherwise along the shortest way
 * around the blocking rect (grown by radius), via one corner or two neighbouring ones. Returns a unit vector.
 * ponytail: only the first blocking rect counts; push-out handles a neighbour in the way. Grid A* if layouts get mazy.
 */
export function steerAround(x: number, y: number, tx: number, ty: number, radius: number, rects: readonly Rect[]): Pt {
  const hit = rects.find((r) => segmentHitsRect(x, y, tx, ty, r, radius));
  if (!hit) return unit(tx - x, ty - y);
  const b = box(hit, radius + 6);
  const cs: Pt[] = [{ x: b.l, y: b.t }, { x: b.r, y: b.t }, { x: b.r, y: b.b }, { x: b.l, y: b.b }]; // clockwise
  const me = { x, y }, goal = { x: tx, y: ty };
  const len = (a: Pt, c: Pt) => Math.hypot(c.x - a.x, c.y - a.y);
  const clear = (a: Pt, c: Pt) => !segmentHitsRect(a.x, a.y, c.x, c.y, hit, radius);
  let best = Infinity, aim = goal;
  cs.forEach((c, i) => {
    if (!clear(me, c)) return;
    for (const n of [c, cs[(i + 1) % 4], cs[(i + 3) % 4]]) {
      if (!clear(n, goal)) continue;
      const cost = len(me, c) + len(c, n) + len(n, goal);
      // Standing on the corner already: head for the next waypoint instead of a zero vector.
      if (cost < best) { best = cost; aim = len(me, c) > 2 ? c : n === c ? goal : n; }
    }
  });
  if (best === Infinity) { // pushed into the padding (crowding): fall back to the cheapest corner
    for (const c of cs) {
      const cost = len(me, c) + len(c, goal);
      if (cost < best) { best = cost; aim = c; }
    }
  }
  return unit(aim.x - x, aim.y - y);
}
