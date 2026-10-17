import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// Cleaning set: cleaning weapons reach further (L1); L2 adds knockback, longer puddles and Weaken. Arrays are L1/L2/L3.
// `weakenPct` / `weakenTime` (L2 / L3): every direct hit of a cleaning weapon weakens the enemy (docs/item-hooks-refactor.md "Weaken"). Quiet hits count: the spray cone
// and the mop puddle tick are this family's main delivery, and with their short intervals the status simply stays on whatever they keep touching.
export default defineSet({
  id: Set.cleaning,
  tune: { rangeMult: [1.15, 1.15, 1.25], aoeMult: [1.15, 1.15, 1.25], knockbackMult: [1.4, 1.4, 1.8], puddleExtra: [1, 1, 2], weakenPct: [0, 0.2, 0.2], weakenTime: [0, 2, 2] },
  text: {
    en: {
      name: 'Cleaning',
      bonus: [
        'Cleaning weapons +{rangeMult|pctup}% range/area',
        '+{knockbackMult|pctup}% knockback, puddles last +{puddleExtra} s, hits weaken enemies by {weakenPct|pctn}% for {weakenTime|s}',
        '+{rangeMult|pctup}% range/area, +{knockbackMult|pctup}% knockback, puddles last +{puddleExtra} s, hits weaken enemies by {weakenPct|pctn}% for {weakenTime|s}',
      ],
    },
    de: {
      name: 'Putzen',
      bonus: [
        'Putzwaffen +{rangeMult|pctup} % Reichweite/Fläche',
        '+{knockbackMult|pctup} % Rückstoß, Pfützen halten +{puddleExtra} s länger, Treffer schwächen Gegner um {weakenPct|pctn} % für {weakenTime|s}',
        '+{rangeMult|pctup} % Reichweite/Fläche, +{knockbackMult|pctup} % Rückstoß, Pfützen halten +{puddleExtra} s länger, Treffer schwächen Gegner um {weakenPct|pctn} % für {weakenTime|s}',
      ],
    },
  },
  build: {
    phase: 'set', order: 20,
    weapon(w, c) {
      const def = c.def(w.type);
      if (def.family !== Set.cleaning) return;
      const t = c.tune();
      w.range *= t.rangeMult; w.aoe *= t.aoeMult;
      if (c.tier >= 2 && def.weapon!.pattern === 'puddle') w.duration += t.puddleExtra;
    },
  },
  hooks: {
    // After the statuses, before the scene computes the push: `kbMult` is the last factor of the knockback (any cleaning hit with a kb,
    // aura and puddle ticks included). The teal spritz is for direct hits only. Weaken (L2 / L3) goes on every direct hit (`hit.direct`: no DoT, echo, chain or
    // pop), quiet cone and puddle ticks included. No rng.
    order: 30,
    afterHit(hit, ctx, c) {
      const stats = hit.stats;
      if (!stats || c.tier < 2 || c.def(stats.type).family !== Set.cleaning) return;
      const t = c.tune();
      hit.kbMult *= t.knockbackMult;
      if (hit.direct) ctx.weaken(hit.enemy, t.weakenPct, t.weakenTime);
      const o = hit.opts;
      if (o.kb && !o.isDot && stats.pattern !== 'aura' && stats.pattern !== 'puddle') ctx.fx.spark(hit.enemy.x, hit.enemy.y - 30, 3, 0x3fb7a6);
    },
  },
});
