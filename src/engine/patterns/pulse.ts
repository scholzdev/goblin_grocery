import type { Pattern, PatternHost, WeaponRt } from './types';

/** Vacuum, every frame: drags enemies in range toward the cart and draws dust into the nozzle. */
function suction(h: PatternHost, w: WeaponRt, dt: number): void {
  const sc = h.sc;
  const p = sc.player;
  const st = w.stats;
  let pulling = false;
  for (const e of sc.enemies) {
    if (!e.alive || e.state === 'spawn') continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    // Stop short of the cart so suction doesn't just feed melee enemies into the goblin.
    if (d > st.range + e.def.radius || d < p.radius + e.def.radius + 12) continue;
    pulling = true;
    // Knockback velocity decays at 9/s (updateEnemy), so this settles at `pull` px/s.
    const f = st.pull * 9 * dt * (1 - e.def.knockbackResist * 0.7) / d;
    e.kx += dx * f; e.ky += dy * f;
  }
  sc.fx.suck(p.x, p.y, st.range, pulling && Math.random() < dt * 22, st.frostRing ? 0xcff3ff : undefined);
}

/** Vacuum: constant suction (`tick`), and every cooldown a damage pulse on everything inside the radius. */
export const pulse: Pattern = {
  id: 'pulse',
  tick(h, w, dt, firing) {
    if (firing) suction(h, w, dt);
  },
  fire(h, w) {
    const sc = h.sc;
    const p = sc.player;
    const st = w.stats;
    sc.fx.ring(st.frostRing ? 'fx_frost' : 'fx_pulse', p.x, p.y, st.range * 2.2, 420, undefined, true);
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) > st.range + e.def.radius) continue;
      sc.damageEnemy(e, st.damage, st, {});
      if (st.frostRing) sc.fx.frostBurst(e.x, e.y - 20, 3);
    }
    // Static Cling throws lightning at a few of the groceries inside the pulse.
    if (sc.hooks['pattern:pulse'].length) sc.hooks.emit('pattern:pulse', { stats: st, x: p.x, y: p.y, inside: sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (st.range + e.def.radius) ** 2) });
    h.sound('vacuum_pulse', { volume: 0.7 });
  },
};
