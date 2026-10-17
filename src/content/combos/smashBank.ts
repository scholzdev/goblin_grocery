import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Frying Pan + Piggy Bank: each enemy a sweep hits may drop a coin. The roll is the `hit` stage of `pattern:sweep` (after that enemy's
// damage, before the next enemy's), so the rng draws interleave with the hits as they always did.
export default defineCombo({
  id: Combo.smashBank, requires: [Item.pan, Item.piggy],
  tune: { chance: 0.15 },
  text: {
    en: {
      name: 'Smash the Bank', short: 'Pan hits may drop coins',
      summary: 'Frying Pan touching a Piggy Bank: whack it and coins fall out.',
      detail: 'Every enemy hit by a pan sweep has a {chance|pct} chance to drop a coin.',
    },
    de: {
      name: 'Sparschwein-Schlag', short: 'Pfannentreffer lassen Münzen fallen',
      summary: 'Bratpfanne berührt Sparschwein: draufhauen, und Münzen purzeln heraus.',
      detail: 'Jeder von einem Pfannenschwung getroffene Gegner lässt mit {chance|pct} Chance eine Münze fallen.',
    },
  },
  hooks: {
    'pattern:sweep'(ev, ctx, c) {
      if (ev.stage === 'hit' && c.touches(ev.stats.uid) && ctx.rng() < c.tune().chance) ctx.dropCoin(ev.enemy!, ctx.t('coinSmash'));
    },
  },
});
