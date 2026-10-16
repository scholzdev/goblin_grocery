import { defineSet } from '../../engine/define';

// Cleaning set: cleaning weapons reach further (L1); L2 adds knockback and longer puddles. Arrays are L1/L2/L3.
export default defineSet({
  id: 'cleaning',
  tune: { rangeMult: [1.15, 1.15, 1.25], aoeMult: [1.15, 1.15, 1.25], knockbackMult: [1.4, 1.4, 1.8], puddleExtra: [1, 1, 2] },
  text: {
    en: {
      name: 'Cleaning',
      bonus: [
        'Cleaning weapons +{rangeMult|pctup}% range/area',
        '+{knockbackMult|pctup}% knockback, puddles last +{puddleExtra} s',
        '+{rangeMult|pctup}% range/area, +{knockbackMult|pctup}% knockback, puddles last +{puddleExtra} s',
      ],
    },
    de: {
      name: 'Putzen',
      bonus: [
        'Putzwaffen +{rangeMult|pctup} % Reichweite/Fläche',
        '+{knockbackMult|pctup} % Rückstoß, Pfützen halten +{puddleExtra} s länger',
        '+{rangeMult|pctup} % Reichweite/Fläche, +{knockbackMult|pctup} % Rückstoß, Pfützen halten +{puddleExtra} s länger',
      ],
    },
  },
  build: {
    phase: 'set', order: 20,
    weapon(w, c) {
      const def = c.def(w.type);
      if (def.family !== 'cleaning') return;
      const t = c.tune();
      w.range *= t.rangeMult; w.aoe *= t.aoeMult;
      if (c.tier >= 2 && def.weapon!.pattern === 'puddle') w.duration += t.puddleExtra;
    },
  },
  hooks: {
    // After the statuses, before the scene computes the push: `kbMult` is the last factor of the knockback (any cleaning hit with a kb,
    // aura and puddle ticks included). The teal spritz is for direct hits only. No rng.
    order: 30,
    afterHit(hit, ctx, c) {
      const stats = hit.stats;
      if (!stats || c.tier < 2 || c.def(stats.type).family !== 'cleaning') return;
      hit.kbMult *= c.tune().knockbackMult;
      const o = hit.opts;
      if (o.kb && !o.isDot && stats.pattern !== 'aura' && stats.pattern !== 'puddle') ctx.fx.spark(hit.enemy.x, hit.enemy.y - 30, 3, 0x3fb7a6);
    },
  },
});
