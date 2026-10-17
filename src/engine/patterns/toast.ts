import { degToRad, emitFire, origin } from './common';
import type { Pattern } from './types';

/** Toaster: a volley of `count` toasts toward the nearest enemy, fanned out `spreadDeg` apart (12° when a recipe set none). Projectile flight is `projectile.ts`. */
export const toast: Pattern = {
  id: 'toast',
  fire(h, w, target) {
    const o = origin(h), st = w.stats;
    const base = Math.atan2(target!.y - o.y, target!.x - o.x);
    // Multipack can add projectiles without a recipe spread: fan them out a little so they don't overlap.
    const spread = degToRad(st.spreadDeg || 12);
    for (let i = 0; i < st.count; i++) {
      const a = base + (st.count > 1 ? (i - (st.count - 1) / 2) * spread : 0);
      if (emitFire(h, st, o.x, o.y, a, i === 0)) continue; // a hook fired its own shot
      h.spawn('proj_toast', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
    }
    h.sound('toast_pop', { rate: h.looks.get(st.uid)?.soundRate ?? 1 });
  },
};
