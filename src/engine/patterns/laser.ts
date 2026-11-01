import { DEPTH } from '../../data/depth';
import { newHitTracker, tryHit } from '../../systems/combat';
import { aimAngle, origin } from './common';
import type { Pattern, PatternEnemy, PatternHost, WeaponRt } from './types';

/**
 * Self-Checkout Laser: one beam that hits every enemy along the line once, aimed down the line that crosses the most groceries. `echo`: a
 * re-fired beam (Power Surge's aftershock: lighter push, higher zap). Also what `ctx.beam` runs.
 */
export function beamOnce(h: PatternHost, w: WeaponRt, target: PatternEnemy, echo = false): void {
  const sc = h.sc;
  const st = w.stats;
  const o = origin(h);
  const inBeam = (e: PatternEnemy, cx: number, cy: number): boolean => {
    const dx = e.x - o.x, dy = e.y - o.y, along = dx * cx + dy * cy;
    return along >= 0 && along <= st.range && Math.abs(dx * cy - dy * cx) <= e.def.radius + 14;
  };
  // Aim down the line that crosses the most groceries; the nearest target is tried first, so it wins ties.
  // ponytail: O(n²) over live enemies every ~1.6 s (n ≤ ~70); sweep sorted angles if counts ever grow.
  const live = sc.enemies.filter((e) => e.alive && e.state !== 'spawn');
  let a = aimAngle(h, target, w.targetMode), best = -1;
  // Mouse aim takes control of the beam direction. Without it, keep the laser's
  // special behavior of choosing the line that crosses the most groceries.
  if (w.targetMode !== 'cursor' || sc.aimAngle === null) {
    for (const t of [target, ...live]) {
      if (Math.hypot(t.x - o.x, t.y - o.y) > st.range) continue;
      const ta = Math.atan2(t.y - o.y, t.x - o.x), tx = Math.cos(ta), ty = Math.sin(ta);
      const n = live.reduce((k, e) => k + (inBeam(e, tx, ty) ? 1 : 0), 0);
      if (n > best) { best = n; a = ta; }
    }
  }
  const cx = Math.cos(a), cy = Math.sin(a);
  const beam = sc.add.image(o.x, o.y - 30, 'fx_laser').setOrigin(0, 0.5).setRotation(a).setDepth(DEPTH.fx)
    .setDisplaySize(st.range, 34);
  sc.tweens.add({ targets: beam, displayHeight: 4, alpha: 0, duration: 260, ease: 'Cubic.In', onComplete: () => beam.destroy() });
  const tracker = newHitTracker(Infinity);
  // `before`: the enemies in the line, not damaged yet (Price Check marks them so the beam itself hits harder; Power Surge schedules its
  // aftershock and sets the damage of its echo).
  const H = sc.hooks, bev = H['pattern:beam'].length > 0 ? { stats: st, stage: 'before' as 'before' | 'after', target, angle: a, echo, targets: live.filter((e) => inBeam(e, cx, cy)), damageMult: 1, hits: [] as PatternEnemy[] } : null;
  if (bev) H.emit('pattern:beam', bev);
  const mult = bev ? bev.damageMult : 1;
  for (const e of live) {
    if (!inBeam(e, cx, cy) || !tryHit(tracker, e.id)) continue;
    sc.damageEnemy(e, st.damage * mult, st, { kb: echo ? 20 : 70, kbX: cx, kbY: cy });
    bev?.hits.push(e);
  }
  if (bev) { bev.stage = 'after'; H.emit('pattern:beam', bev); }
  h.sound('zap', { rate: echo ? 1.8 : 1.5 });
}

/** Self-Checkout Laser: the barcode beam at the nearest enemy's side of the aisle. */
export const laser: Pattern = {
  id: 'laser',
  fire(h, w, target) { beamOnce(h, w, target!); },
};
