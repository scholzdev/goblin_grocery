import { DEPTH } from '../../data/depth';
import { newHitTracker, tryHit } from '../../systems/combat';
import type { WeaponStats } from '../../types';
import type { AffinityTag } from '../define';
import { origin, repeat } from './common';
import type { Pattern, PatternEnemy, PatternHost, WeaponRt } from './types';

const BLAST: readonly AffinityTag[] = ['blast'];

/** An explosion of `st` at (x, y): everything within `aoe` takes the weapon's damage with knockback. Also what `ctx.explode` runs (Pot Slam). */
export function explodeAt(h: PatternHost, x: number, y: number, st: WeaponStats): void {
  const sc = h.sc;
  const tracker = newHitTracker(Infinity);
  sc.fx.ring('fx_boom', x, y, st.aoe * 2.4, 380);
  sc.fx.puff(x, y - 10, 5);
  sc.fx.crumbsAt(x, y - 10, 8, 0xf5bd45);
  sc.fx.shake(0.003, 90);
  h.sound('boom');
  const hits: PatternEnemy[] | null = sc.hooks['pattern:explode'].length ? [] : null;
  for (const e of sc.enemies) {
    if (!e.alive || e.state === 'spawn') continue;
    const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
    if (d > st.aoe + e.def.radius || !tryHit(tracker, e.id)) continue;
    sc.damageEnemy(e, st.damage, st, { kb: 220, kbX: dx / (d || 1), kbY: dy / (d || 1), tags: BLAST }); // an explosion is a blast hit on top of the pot's own sets
    hits?.push(e);
  }
  if (hits) sc.hooks.emit('pattern:explode', { stats: st, x, y, hits }); // Pressure Point's fire pool, Shrapnel's fragments
}

/** The first enemy with the most others within `aoe` of it. */
function densest(es: readonly PatternEnemy[], aoe: number): PatternEnemy {
  let best = es[0], bestN = -1;
  for (const e of es) {
    const n = es.reduce((k, o) => k + ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < aoe * aoe ? 1 : 0), 0);
    if (n > bestN) { bestN = n; best = e; }
  }
  return best;
}

/** A pot of `st` (sprite drawn at `size`) flying from the nose of the cart to `to`; `update` explodes it on landing. */
function lob(h: PatternHost, st: WeaponStats, to: PatternEnemy, size: number): void {
  const sc = h.sc, o = origin(h);
  const dist = Math.hypot(to.x - o.x, to.y - o.y);
  const img = sc.add.image(o.x, o.y - 30, 'proj_pot').setDepth(DEPTH.fx - 1).setScale(size);
  const shadow = sc.add.image(o.x, o.y, 'shadow').setDisplaySize(30 * size, 9 * size).setAlpha(0.6).setDepth(DEPTH.decal);
  h.pots.push({ img, shadow, sx: o.x, sy: o.y, tx: to.x, ty: to.y, t: 0, dur: Math.max(0.35, dist / st.projectileSpeed), stats: st });
  sc.fx.ring('fx_pulse', to.x, to.y, st.aoe * 2, 500, 0xf45f52);
  h.sound('whistle', { volume: 0.35 });
}

/**
 * Lob a pot at the densest cluster in range; it explodes on landing. With `secondPot` (★3) a pot `secondPotScale` the damage and size
 * goes to the densest cluster of the enemies the first blast will not reach.
 */
function lobPot(h: PatternHost, w: WeaponRt): void {
  const st = w.stats, p = h.sc.player;
  const inRange = h.sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < st.range * st.range);
  if (!inRange.length) return;
  const best = densest(inRange, st.aoe);
  lob(h, st, best, 1);
  if (!(w.tune.secondPot > 0)) return;
  const rest = inRange.filter((e) => (e.x - best.x) ** 2 + (e.y - best.y) ** 2 > (st.aoe + e.def.radius) ** 2);
  if (!rest.length) return;
  const k = w.tune.secondPotScale, small = { ...st, damage: st.damage * k, aoe: st.aoe * k };
  lob(h, small, densest(rest, small.aoe), k);
}

/** Pressure Cooker: a lobbed pot (Multipack lobs more), flying for `dist / projectileSpeed` s, then `explodeAt`. */
export const mortar: Pattern = {
  id: 'mortar',
  fire(h, w) { repeat(h, w, () => lobPot(h, w)); },
  update(h, dt) {
    for (const pot of [...h.pots]) {
      pot.t += dt;
      const k = Math.min(1, pot.t / pot.dur);
      const x = pot.sx + (pot.tx - pot.sx) * k, y = pot.sy + (pot.ty - pot.sy) * k;
      const hgt = Math.sin(k * Math.PI) * (60 + pot.dur * 120);
      pot.img.setPosition(x, y - 30 - hgt).setRotation(k * 6);
      pot.shadow.setPosition(x, y);
      if (k < 1) continue;
      pot.img.destroy(); pot.shadow.destroy();
      h.pots = h.pots.filter((q) => q !== pot);
      explodeAt(h, pot.tx, pot.ty, pot.stats);
    }
  },
};
