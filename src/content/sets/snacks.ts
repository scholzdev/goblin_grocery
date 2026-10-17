import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// Snacks set: more max HP (L1), combat regen on top (L2). Arrays are L1/L2/L3.
export default defineSet({
  id: Set.snacks,
  tune: { maxHp: [10, 10, 20], regen: [0.3, 0.3, 0.6] },
  text: {
    en: {
      name: 'Snacks',
      bonus: [
        '+{maxHp} max HP',
        '+{regen} HP/s regen in combat',
        '+{maxHp} max HP, +{regen} HP/s regen in combat',
      ],
    },
    de: {
      name: 'Snacks',
      bonus: [
        '+{maxHp} max. LP',
        '+{regen} LP/s Regeneration im Kampf',
        '+{maxHp} max. LP, +{regen} LP/s Regeneration im Kampf',
      ],
    },
  },
  build: {
    // Adds onto the literal's base (PLAYER.maxHp + perk). `order` 10: after the items that add (Lunchbox, Snack Bag: order 0), before
    // Expired Milk's x0.9 (100). The regen field is read by the arena every frame.
    phase: 'final', order: 10,
    player(b, c) {
      const t = c.tune();
      b.maxHp += t.maxHp;
      if (c.tier >= 2) b.regen += t.regen;
    },
  },
});
