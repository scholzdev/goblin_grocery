import { aimAngle, emitFire, origin } from './common';
import type { Pattern, PatternEnemy, PatternHost, WeaponRt } from './types';

const aimed = new WeakMap<WeaponRt, Set<number>>();

function nailTarget(h: PatternHost, w: WeaponRt): PatternEnemy | null {
  const sc = h.sc, range = w.stats.range, seen = aimed.get(w);
  if (!seen) return sc.targetForWeapon(range, w.targetMode);
  const t = sc.nearestEnemyFrom(sc.player.x, sc.player.y, range, seen) ?? sc.targetForWeapon(range, w.targetMode);
  if (t) seen.add(t.id);
  return t;
}

function fireNail(h: PatternHost, w: WeaponRt, target: PatternEnemy): void {
  const o = origin(h), st = w.stats;
  const a = aimAngle(h, target, w.targetMode) + (h.sc.rng() - 0.5) * 0.08; // the one rng draw per nail
  if (emitFire(h, st, o.x, o.y, a, w.burstLeft === st.count)) return; // Ray Gun fires its energy bolt instead of the nail
  h.spawn('proj_nail', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
  if (w.burstLeft === st.count) h.sound('nail_burst');
}

/** Nail Gun: the cooldown starts a burst of `count` nails, one every `burstInterval` s, each aimed at the nearest enemy at that moment. */
export const burst: Pattern = {
  id: 'burst',
  tick(h, w, dt) {
    if (w.burstLeft <= 0) return;
    w.burstT -= dt;
    if (w.burstT > 0) return;
    const t = nailTarget(h, w);
    if (t) fireNail(h, w, t);
    w.burstLeft--;
    w.burstT = w.stats.burstInterval;
  },
  fire(_h, w) {
    w.burstLeft = w.stats.count;
    w.burstT = 0;
    if (w.tune.spreadNails > 0) aimed.set(w, new Set());
  },
};
