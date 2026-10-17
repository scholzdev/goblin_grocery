import { DEPTH } from '../../data/depth';
import { newHitTracker, tryHit } from '../../systems/combat';
import { applyWet } from '../wet';
import { weaponDamageMult, wrapAngle } from '../define';
import { degToRad, repeat } from './common';
import type { Pattern, PatternEnemy, PatternHost, WeaponRt } from './types';

/**
 * One cone toward the nearest enemy; every enemy inside is hit once per blast. Parameters from the weapon's content: `base.knockback`
 * (default 40), `base.fx` (the sprite, default the spray), `tune.blow` (Leaf Blower: slam damage at ★1, scaled by the weapon's tier), `tune.wet` (Spray Bottle: seconds of Wet on every hit enemy).
 */
function coneOnce(h: PatternHost, w: WeaponRt): void {
  const sc = h.sc;
  const p = sc.player;
  const st = w.stats;
  const t = sc.nearestEnemy(st.range + 40);
  if (!t) return;
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  const half = degToRad(st.arcDeg / 2);
  const blow = w.tune.blow !== undefined ? w.tune.blow * weaponDamageMult(st.tier) : undefined;
  const fx = sc.add.image(p.x + Math.cos(a) * 20, p.y - 26 + Math.sin(a) * 20, w.base.fx ?? 'fx_spray').setOrigin(0, 0.5).setRotation(a).setDepth(DEPTH.fx - 2)
    .setDisplaySize(st.range * 0.6, st.range * Math.tan(half) * 1.2 + 20).setAlpha(0.9);
  sc.tweens.add({ targets: fx, displayWidth: st.range * 1.05, alpha: 0, duration: 260, ease: 'Cubic.Out', onComplete: () => fx.destroy() });
  const tracker = newHitTracker(Infinity);
  const hits: PatternEnemy[] | null = sc.hooks['pattern:cone'].length ? [] : null;
  for (const e of sc.enemies) {
    if (!e.alive || e.state === 'spawn') continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > st.range + e.def.radius) continue;
    if (Math.abs(wrapAngle(Math.atan2(dy, dx) - a)) > half && d > e.def.radius + p.radius) continue;
    if (!tryHit(tracker, e.id)) continue;
    if (w.tune.wet) applyWet(e.status, w.tune.wet, sc.time.now / 1000); // the Spray Bottle soaks what it hits, before the hit (so a frost slow / electric bonus of this very hit reacts)
    sc.damageEnemy(e, st.damage, st, { kb: w.base.knockback ?? 40, kbX: dx / (d || 1), kbY: dy / (d || 1), quiet: true, blow });
    hits?.push(e);
  }
  if (hits) sc.hooks.emit('pattern:cone', { stats: st, x: p.x, y: p.y, angle: a, hits }); // Sour Mist poisons the hits, Tailwind pushes the cart
  h.sound('spray');
}

/** Spray Bottle and Leaf Blower: a cone blast (Multipack repeats it). */
export const cone: Pattern = {
  id: 'cone',
  fire(h, w) { repeat(h, w, () => coneOnce(h, w)); },
};
