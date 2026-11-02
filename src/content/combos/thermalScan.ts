import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Self-Checkout Laser + Fuel Can: every beam leaves `pools` fire pools spaced along its line. They only burn because the laser carries the Fuel burn
// (`spawnPool` ignores a weapon without one), at least `dps` hard. Echo beams leave none (the pool count is shared with all puddles, cap 14).
export default defineCombo({
  id: Combo.thermalScan, requires: [Item.laser, Item.fuel],
  tune: { pools: 3, poolTime: 2, radius: 45, dps: 3, duration: 2, tick: 0.5 },
  text: {
    en: {
      name: 'Thermal Scanner', short: 'Beam leaves a burning line',
      summary: 'Self-Checkout Laser touching a Fuel Can: the scan line stays hot.',
      detail: 'Each beam leaves {pools} fire pools along its line for {poolTime|s}: enemies inside burn (at least {dps|ps}, no stacking).',
    },
    de: {
      name: 'Wärmescanner', short: 'Strahl hinterlässt eine brennende Linie',
      summary: 'Selbstscan-Laser berührt Benzinkanister: die Scanlinie bleibt heiß.',
      detail: 'Jeder Strahl hinterlässt {pools} Feuerlachen entlang seiner Linie für {poolTime|s}: Gegner darin brennen (mindestens {dps|ps}, kein Stapeln).',
    },
  },
  hooks: {
    'pattern:beam'(ev, ctx, c) {
      if (ev.stage !== 'before' || ev.echo || !c.touches(ev.stats.uid)) return;
      const t = c.tune(), p = ctx.player, ox = p.x + p.facing * 18, oy = p.y;
      for (let i = 0; i < t.pools; i++) {
        const d = ev.stats.range * (i + 0.5) / t.pools;
        ctx.spawnPool({ x: ox + Math.cos(ev.angle) * d, y: oy + Math.sin(ev.angle) * d, r: t.radius, time: t.poolTime, stats: ev.stats, tune: t });
      }
    },
  },
});
