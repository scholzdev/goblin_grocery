import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.snackbag, kind: 'passive', sets: [Set.snacks], shape: '2x2', price: 30, legendary: true,
  // Legendary: ★1 only, so every value is a scalar. Regeneration is `regenHp` every `interval` seconds (0.25 HP/s).
  tune: { hp: 20, regenHp: 1, interval: 4 },
  text: {
    en: { name: 'Family-Size Snack Bag', blurb: 'Bottomless. Probably.', rules: '+{hp|int} max HP and regenerate {regenHp|int} HP every {interval|s} during combat (does not stack).' },
    de: { name: 'Familienpackung Snacks', blurb: 'Bodenlos. Vermutlich.', rules: '+{hp|int} max. LP und {regenHp|int} LP Regeneration alle {interval|s} im Kampf (stapelt sich nicht).' },
  },
  build: {
    // Both add: max HP onto Lunchbox's and the snacks set's (the total is rounded later), regen onto the snacks set's L2/L3 regen.
    phase: 'final',
    player(b, c) { const t = c.tune(); b.maxHp += t.hp; b.regen += t.regenHp / t.interval; },
  },
});
