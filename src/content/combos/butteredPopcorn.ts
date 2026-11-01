import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Popcorn Maker + Lunchbox: a ready snack keeps the machine's volley cycle moving.
export default defineCombo({
  id: Combo.butteredPopcorn, requires: [Item.popcorn, Item.lunchbox],
  tune: { cooldown: 0.88 },
  text: {
    en: { name: 'Buttered Popcorn', short: 'Pops faster', summary: 'Popcorn touching a Lunchbox: the snack line stays stocked.', detail: 'Popcorn cooldown is reduced by {cooldown|pctdown}.' },
    de: { name: 'Butterpopcorn', short: 'Popp schneller', summary: 'Popcorn berührt eine Lunchbox: Die Snacklinie bleibt versorgt.', detail: 'Der Popcorn-Cooldown sinkt um {cooldown|pctdown}.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.cooldown *= c.tune().cooldown; } },
});
