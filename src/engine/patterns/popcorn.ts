import { origin } from './common';
import type { Pattern } from './types';

/** Popcorn Maker: `count` kernels per volley, each at a random living enemy in range (not the nearest) or, with none in range, at a random angle. One rng draw per kernel. */
export const popcorn: Pattern = {
  id: 'popcorn',
  fire(h, w) {
    const o = origin(h), st = w.stats, sc = h.sc, p = sc.player;
    const near = sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < st.range ** 2);
    for (let i = 0; i < st.count; i++) {
      const t = near.length ? near[Math.floor(sc.rng() * near.length)] : null;
      const a = t ? Math.atan2(t.y - o.y, t.x - o.x) : sc.rng() * Math.PI * 2;
      h.spawn('proj_kernel', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
    }
    h.sound('toast_pop');
  },
};
