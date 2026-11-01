import type { WeaponStats } from '../../types';
import { aimAngle, degToRad, emitFire, origin } from './common';
import type { Pattern, PatternHost } from './types';

function throwToast(h: PatternHost, st: WeaponStats, o: { x: number; y: number }, a: number, first: boolean): void {
  if (emitFire(h, st, o.x, o.y, a, first)) return;
  h.spawn('proj_toast', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
}

/** Toaster: `spreadDeg` defaults to 12° when a recipe set none. */
export const toast: Pattern = {
  id: 'toast',
  fire(h, w, target) {
    const o = origin(h), st = w.stats, p = h.sc.player;
    const base = aimAngle(h, target, w.targetMode);
    // Multipack can add projectiles without a recipe spread: fan them out a little so they don't overlap.
    const spread = degToRad(st.spreadDeg || 12);
    for (let i = 0; i < st.count; i++) throwToast(h, st, o, base + (st.count > 1 ? (i - (st.count - 1) / 2) * spread : 0), i === 0);
    const next = w.tune.secondToast > 0 ? h.sc.nearestEnemyFrom(p.x, p.y, st.range, new Set([target!.id])) : null;
    if (next) throwToast(h, st, o, Math.atan2(next.y - o.y, next.x - o.x), false);
    h.sound('toast_pop', { rate: h.looks.get(st.uid)?.soundRate ?? 1 });
  },
};
