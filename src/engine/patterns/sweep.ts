import { DEPTH } from '../../data/depth';
import { newHitTracker, tryHit } from '../../systems/combat';
import { hasStar3, wrapAngle } from '../define';
import { aimAngle, degToRad, repeat } from './common';
import type { Pattern, PatternEnemy, PatternHost, WeaponRt } from './types';

/**
 * One arc sweep around the cart at `angle`; each enemy at most once per swing. `bonus`: the lighter extra swing (Express Checkout).
 * Also what `ctx.sweep` runs, so combos can swing a pan on demand.
 */
export function sweepOnce(h: PatternHost, w: WeaponRt, angle: number, bonus = false): void {
  const sc = h.sc;
  const p = sc.player;
  const st = w.stats;
  let range = st.range, dmg = st.damage;
  // `before`: hooks may change range/dmg (Chicken Dinner's big serving); `hit`: after each enemy's damage (Smash the Bank's coin roll);
  // `after`: the arc is resolved (Sizzling Skillet scorches the floor).
  const swing = sc.hooks['pattern:sweep'].length ? { stats: st, stage: 'before' as 'before' | 'after' | 'hit', x: p.x, y: p.y, angle, bonus, range, dmg, hits: [] as PatternEnemy[], enemy: undefined as PatternEnemy | undefined } : null;
  if (swing) { sc.hooks.emit('pattern:sweep', swing); range = swing.range; dmg = swing.dmg; }
  const tracker = newHitTracker(Infinity);
  const half = degToRad((hasStar3(st.tier) && w.tune.fullArc ? w.tune.fullArc : st.arcDeg) / 2);
  const fx = sc.add.image(p.x, p.y - 22, 'fx_sweep').setRotation(angle + Math.PI).setDepth(DEPTH.fx - 2)
    .setScale(range / 70 * 0.55).setAlpha(0.95);
  if (bonus) fx.setTint(0xfff2d5);
  sc.tweens.add({ targets: fx, scale: range / 70, alpha: 0, rotation: angle + Math.PI + (half >= Math.PI ? 2 * Math.PI : 0.5) * (Math.random() < 0.5 ? 1 : -1), duration: 220, ease: 'Cubic.Out', onComplete: () => fx.destroy() });
  for (const e of sc.enemies) {
    if (!e.alive || e.state === 'spawn') continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > range + e.def.radius) continue;
    const diff = Math.abs(wrapAngle(Math.atan2(dy, dx) - angle));
    if (diff > half && d > e.def.radius + p.radius) continue;
    if (!tryHit(tracker, e.id)) continue;
    sc.damageEnemy(e, dmg, st, { kb: 150, kbX: dx / (d || 1), kbY: dy / (d || 1) });
    if (swing) { swing.hits.push(e); swing.stage = 'hit'; swing.enemy = e; sc.hooks.emit('pattern:sweep', swing); swing.stage = 'before'; swing.enemy = undefined; }
  }
  if (swing) { swing.stage = 'after'; sc.hooks.emit('pattern:sweep', swing); }
  h.sound('pan_clang', { rate: bonus ? 1.25 : 1 });
}

/** Frying Pan: a big arc toward the nearest enemy. Multipack repeats the swing. */
export const sweep: Pattern = {
  id: 'sweep',
  fire(h, w) {
    const sc = h.sc;
    repeat(h, w, () => {
      const t = sc.targetForWeapon(w.stats.range, w.targetMode);
      if (t) sweepOnce(h, w, aimAngle(h, t, w.targetMode));
    });
  },
};
