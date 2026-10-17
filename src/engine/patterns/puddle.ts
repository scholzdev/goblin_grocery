import { DEPTH } from '../../data/depth';
import { applyBurn, applySlow } from '../../systems/combat';
import type { WeaponStats } from '../../types';
import type { Pattern, PatternHost, Puddle } from './types';

export function removePuddle(h: PatternHost, pd: Puddle): void {
  pd.img.destroy();
  h.puddles = h.puddles.filter((x) => x !== pd);
}

/** Burning floor patch (Pressure Point, Reheat, Sizzling Skillet, spawned through `ctx.spawnPool`): no direct damage. Burns for the recipe's tuning, at least as hard and as long as the weapon's own Fuel burn. */
export function spawnFirePool(h: PatternHost, x: number, y: number, r: number, time: number, st: WeaponStats, tune: { dps: number; duration: number; tick: number }): void {
  if (!st.burn) return;
  if (h.puddles.length >= 14) removePuddle(h, h.puddles[0]);
  const img = h.sc.add.image(x, y, 'fx_puddle_fire').setDepth(DEPTH.decal).setDisplaySize(r * 1.8, r * 1.1).setAlpha(0.9);
  h.puddles.push({ img, x, y, r: r * 0.9, until: h.time + time, nextTick: h.time, stats: st, burnOnly: true, burn: { dps: Math.max(tune.dps, st.burn.dps), duration: Math.max(tune.duration, st.burn.duration), tick: tune.tick } });
}

function dropPuddle(h: PatternHost, w: { stats: WeaponStats; tune: Readonly<Record<string, number>> }): void {
  const p = h.sc.player;
  if (h.puddles.length >= 14) removePuddle(h, h.puddles[0]);
  const st = w.stats;
  const key = h.looks.get(st.uid)?.puddleKey ?? 'fx_puddle';
  const x = p.x - p.facing * 40, y = p.y + 4;
  const img = h.sc.add.image(x, y, key).setDepth(DEPTH.decal).setDisplaySize(st.range * 0.6, st.range * 0.4).setAlpha(0.9);
  h.sc.tweens.add({ targets: img, displayWidth: st.range * 2.2, displayHeight: st.range * 1.36, duration: 200, ease: 'Back.Out' });
  h.puddles.push({ img, x, y, r: st.range, until: h.time + st.duration, nextTick: h.time + 0.1, stats: st, slow: { pct: w.tune.slowPct, duration: w.tune.slowDuration } });
  h.sound('splash');
}

/**
 * Mop: drops a puddle behind the cart every cooldown (no target needed). Enemies inside get a slow and a damage tick every `tick` s. The
 * slow is the weapon's `tune.slowPct` / `slowDuration`.
 */
export const puddle: Pattern = {
  id: 'puddle',
  blind: true,
  fire(h, w) { dropPuddle(h, w); },
  update(h) {
    const sc = h.sc;
    for (const pd of [...h.puddles]) {
      if (h.time >= pd.until) { removePuddle(h, pd); continue; }
      if (pd.until - h.time < 0.5) pd.img.setAlpha(0.9 * (pd.until - h.time) / 0.5);
      h.looks.get(pd.stats.uid)?.puddleFx?.(pd, sc.fx); // Grease Fire's flames
      if (h.time < pd.nextTick) continue;
      pd.nextTick += pd.stats.tick; // fixed tick: each enemy inside is hit once per tick
      const now = sc.time.now / 1000;
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        // Floor ellipse test (puddles are drawn flattened).
        const dx = (e.x - pd.x) / pd.r, dy = (e.y - pd.y) / (pd.r * 0.62);
        if (dx * dx + dy * dy > 1) continue;
        if (pd.burnOnly) { if (pd.burn) applyBurn(e.status, sc.aisleEvent.burn(pd.burn), now); continue; }
        let slow = pd.slow!;
        if (sc.hooks['pattern:puddleEnter'].length) {
          const seen = (pd.seen ??= new Set()), first = !seen.has(e.id);
          seen.add(e.id);
          const ev = { stats: pd.stats, enemy: e, puddle: pd, first, slow };
          sc.hooks.emit('pattern:puddleEnter', ev);
          slow = ev.slow; // the Frost set strengthens it
        }
        applySlow(e.status, slow, now);
        sc.damageEnemy(e, pd.stats.damage, pd.stats, { quiet: true });
      }
    }
  },
};
