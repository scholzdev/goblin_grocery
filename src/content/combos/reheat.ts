import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Microwave + Fuel Can: the first target of every zap keeps burning (a fire pool at its spot, before the zap's damage). Only burns when the
// microwave has a Fuel burn.
export default defineCombo({
  id: Combo.reheat, requires: [Item.microwave, Item.fuel],
  tune: { dps: 3, duration: 2, tick: 0.5, poolTime: 2.5 },
  text: {
    en: {
      name: 'Reheat', short: 'Zaps leave fire',
      summary: 'Microwave touching a Fuel Can: overcooked!',
      detail: 'Every zap leaves a burning pool at its target for {poolTime|s}: enemies inside burn (at least {dps} damage/s, no stacking).',
    },
    de: {
      name: 'Aufwärmen', short: 'Zaps hinterlassen Feuer',
      summary: 'Mikrowelle berührt Benzinkanister: angebrannt!',
      detail: 'Jeder Zap hinterlässt {poolTime|s} lang eine brennende Lache am Ziel: Gegner darin brennen (mindestens {dps} Schaden/s, kein Stapeln).',
    },
  },
  hooks: {
    'pattern:zap'(ev, ctx, c) {
      if (ev.stage !== 'before' || ev.link !== 0 || !c.touches(ev.stats.uid)) return;
      const t = c.tune();
      ctx.spawnPool({ x: ev.target.x, y: ev.target.y, r: ev.stats.aoe, time: t.poolTime, stats: ev.stats, tune: t });
    },
  },
});
