import { emitFire, origin } from './common';
import type { Pattern } from './types';

/** Fizz Cannon: bottle caps that bounce on to other enemies (the bounce itself is in `projectile.ts`). `count` caps fan out 0.2 rad apart. */
export const ricochet: Pattern = {
  id: 'ricochet',
  fire(h, w, target) {
    const o = origin(h), st = w.stats;
    const a = Math.atan2(target!.y - o.y, target!.x - o.x);
    for (let i = 0; i < st.count; i++) {
      const ai = a + (i - (st.count - 1) / 2) * 0.2;
      if (emitFire(h, st, o.x, o.y, ai, i === 0)) continue;
      h.spawn('proj_cap', o.x, o.y, ai, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.bounces + st.pierce);
    }
    h.sound('cap_ping', { rate: 0.8 });
  },
};
