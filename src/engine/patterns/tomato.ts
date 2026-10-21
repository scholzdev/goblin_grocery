import { degToRad, emitFire, origin } from './common';
import type { Pattern } from './types';

/** Throw at the nearest unpoisoned grocery, falling back to the usual target when all are poisoned. */
export const tomato: Pattern = {
  id: 'tomato',
  fire(h, w, target) {
    const st = w.stats, p = h.sc.player, o = origin(h), now = h.sc.time.now / 1000;
    const poisoned = new Set(h.sc.enemies.filter((e) => e.status.poisonUntil > now).map((e) => e.id));
    const fresh = h.sc.nearestEnemyFrom(p.x, p.y, st.range, poisoned);
    const aim = fresh ?? target!;
    const base = Math.atan2(aim.y - o.y, aim.x - o.x), spread = degToRad(st.spreadDeg || 12);
    for (let i = 0; i < st.count; i++) {
      const angle = base + (i - (st.count - 1) / 2) * spread;
      if (emitFire(h, st, o.x, o.y, angle, i === 0)) continue;
      const shot = h.spawn('proj_tomato', o.x, o.y, angle, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
      if (shot) shot.spin = 7;
    }
    h.sound('pop', { rate: 0.75 });
  },
};
