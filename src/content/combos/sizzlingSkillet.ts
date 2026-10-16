import { defineCombo } from '../../engine/define';

const DEG = Math.PI / 180;

// Frying Pan + Fuel Can: every sweep (also Express Checkout's) leaves `pools` fire pools along the arc. They only burn when the pan has a
// Fuel burn.
export default defineCombo({
  id: 'sizzlingSkillet', requires: ['pan', 'fuel'],
  tune: { dps: 4, duration: 2, tick: 0.5, poolTime: 2, pools: 3 },
  text: {
    en: {
      name: 'Sizzling Skillet', short: 'Sweeps leave fire',
      summary: 'Frying Pan touching a Fuel Can: every sweep scorches the floor.',
      detail: 'Each sweep leaves a burning arc on the floor for {poolTime|s}. Enemies walking through it catch fire (at least {dps} damage/s, no stacking).',
    },
    de: {
      name: 'Zischende Pfanne', short: 'Schwünge hinterlassen Feuer',
      summary: 'Bratpfanne berührt Benzinkanister: jeder Schwung versengt den Boden.',
      detail: 'Jeder Schwung hinterlässt {poolTime|s} lang einen brennenden Bogen auf dem Boden. Gegner, die hindurchlaufen, fangen Feuer (mindestens {dps} Schaden/s, kein Stapeln).',
    },
  },
  hooks: {
    'pattern:sweep'(ev, ctx, c) {
      if (ev.stage !== 'after' || !c.touches(ev.stats.uid)) return;
      const t = c.tune(), st = ev.stats;
      for (let i = 0; i < t.pools; i++) {
        const a = ev.angle + (i / (t.pools - 1) - 0.5) * (st.arcDeg * DEG) * 0.8;
        ctx.spawnPool({ x: ev.x + Math.cos(a) * st.range * 0.7, y: ev.y + Math.sin(a) * st.range * 0.7 * 0.62, r: 34, time: t.poolTime, stats: st, tune: t });
      }
    },
  },
});
