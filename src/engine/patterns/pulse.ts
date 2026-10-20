import { hasStar3 } from '../define';
import type { Pattern, PatternHost, WeaponRt } from './types';

/** The suction range and pull multiplier right now: the weapon's own, times Full Suck's boost while it runs. */
function boosted(h: PatternHost, w: WeaponRt): { pull: number; range: number } {
  const b = w.boost && w.boost.until > h.time ? w.boost : null;
  return { pull: b ? b.pull : 1, range: w.stats.range * (b ? b.range : 1) };
}

/** Vacuum, every frame: drags enemies in range toward the cart and draws dust into the nozzle. */
function suction(h: PatternHost, w: WeaponRt, dt: number): void {
  const sc = h.sc;
  const p = sc.player;
  const st = w.stats;
  const { pull: pullMult, range } = boosted(h, w);
  let pulling = false;
  for (const e of sc.enemies) {
    if (!e.alive || e.state === 'spawn') continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    // Stop short of the cart so suction doesn't just feed melee enemies into the goblin.
    if (d > range + e.def.radius || d < p.radius + e.def.radius + 12) continue;
    pulling = true;
    // Knockback velocity decays at 9/s (updateEnemy), so this settles at `pull` px/s.
    const f = st.pull * pullMult * 9 * dt * (1 - e.def.knockbackResist * 0.7) / d;
    e.kx += dx * f; e.ky += dy * f;
  }
  sc.fx.suck(p.x, p.y, range, pulling && Math.random() < dt * 22, st.frostRing ? 0xcff3ff : undefined);
}

/** Vacuum: constant suction (`tick`), and every cooldown a damage pulse on everything inside the radius; from ★3 it knocks the groceries within `tune.nozzle` of the cart's edge back out (`tune.blowback`). */
export const pulse: Pattern = {
  id: 'pulse',
  tick(h, w, dt, firing) {
    if (firing) suction(h, w, dt);
  },
  fire(h, w) {
    const sc = h.sc;
    const p = sc.player;
    const st = w.stats;
    const { range } = boosted(h, w);
    const blowback = hasStar3(st.tier) ? w.tune.blowback : 0;
    sc.fx.ring(st.frostRing ? 'fx_frost' : 'fx_pulse', p.x, p.y, range * 2.2, 420, undefined, true);
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > range + e.def.radius) continue;
      const atCart = blowback > 0 && d < p.radius + e.def.radius + w.tune.nozzle;
      sc.damageEnemy(e, st.damage, st, atCart ? { kb: blowback, kbX: dx / (d || 1), kbY: dy / (d || 1) } : {});
      if (st.frostRing) sc.fx.frostBurst(e.x, e.y - 20, 3);
    }
    // Static Cling throws lightning at a few of the groceries inside the pulse.
    if (sc.hooks['pattern:pulse'].length) sc.hooks.emit('pattern:pulse', { stats: st, x: p.x, y: p.y, inside: sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (range + e.def.radius) ** 2) });
    h.sound('vacuum_pulse', { volume: 0.7 });
  },
};
