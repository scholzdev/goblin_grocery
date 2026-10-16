import { defineCombo } from '../../engine/define';

// Pressure Cooker + Fuel Can: every explosion (lobbed, or Pot Slam's) leaves a fire pool. The pool only burns when the cooker has a Fuel
// burn (`spawnPool` ignores it otherwise), at least `dps` hard.
export default defineCombo({
  id: 'pressurePoint', requires: ['cooker', 'fuel'],
  tune: { dps: 3, duration: 2, tick: 0.5, poolTime: 2.5 },
  text: {
    en: {
      name: 'Pressure Point', short: 'Blasts leave fire pools',
      summary: 'Pressure Cooker touching a Fuel Can: blasts leave burning pools.',
      detail: 'Each explosion leaves a fire pool for {poolTime|s}: enemies inside burn (at least {dps} damage/s, no stacking).',
    },
    de: {
      name: 'Druckpunkt', short: 'Explosionen hinterlassen Feuerlachen',
      summary: 'Schnellkochtopf berührt Benzinkanister: Explosionen hinterlassen brennende Lachen.',
      detail: 'Jede Explosion hinterlässt {poolTime|s} lang eine Feuerlache: Gegner darin brennen (mindestens {dps} Schaden/s, kein Stapeln).',
    },
  },
  build: {
    phase: 'combo',
    // `firePool` stays on the weapon stats for the golden snapshots; nothing reads it, the hook below owns the behavior.
    weapon(w) { w.firePool = true; },
  },
  hooks: {
    'pattern:explode'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune();
      ctx.spawnPool({ x: ev.x, y: ev.y, r: ev.stats.aoe, time: t.poolTime, stats: ev.stats, tune: t });
    },
  },
});
