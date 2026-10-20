import { origin } from './common';
import type { Pattern, PatternHost, Shot } from './types';

export function repopKernel(h: PatternHost, s: Shot, damage: number): void {
  const st = s.stats!, t = h.sc.nearestEnemyFrom(s.x, s.y, st.range);
  if (!t) return;
  h.spawn('proj_kernel', s.x, s.y, Math.atan2(t.y - s.y, t.x - s.x), st.projectileSpeed, st.range / st.projectileSpeed, damage, st, 1 + st.pierce);
  h.sound('toast_pop', { rate: 1.4, volume: 0.5 });
}

/** Popcorn Maker: each kernel aims at a random enemy in range, not the nearest, with one rng draw per kernel (replays depend on it). */
export const popcorn: Pattern = {
  id: 'popcorn',
  fire(h, w) {
    const o = origin(h), st = w.stats, sc = h.sc, p = sc.player;
    const near = sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < st.range ** 2);
    const repop = w.tune.repop > 0 ? st.damage * w.tune.repopDamage : 0;
    for (let i = 0; i < st.count; i++) {
      const t = near.length ? near[Math.floor(sc.rng() * near.length)] : null;
      const a = t ? Math.atan2(t.y - o.y, t.x - o.x) : sc.rng() * Math.PI * 2;
      const kernel = h.spawn('proj_kernel', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
      if (kernel) kernel.repop = repop;
    }
    h.sound('toast_pop');
  },
};
