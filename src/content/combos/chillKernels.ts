import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Popcorn Maker + Ice Pack: kernels chill the aisle and keep enemies moving slowly between volleys.
export default defineCombo({
  id: Combo.chillKernels, requires: [Item.popcorn, Item.ice],
  tune: { pct: 0.45, duration: 0.7 },
  text: {
    en: { name: 'Chill Kernels', short: 'Kernels slow enemies', summary: 'Popcorn touching an Ice Pack: every kernel carries a chill.', detail: 'Kernel hits slow enemies by {pct|pct} for {duration|s}.' },
    de: { name: 'Kühle Körner', short: 'Körner bremsen Gegner', summary: 'Popcorn berührt einen Kühlakku: Jedes Korn trägt Kälte.', detail: 'Körnertreffer verlangsamen Gegner um {pct|pct} für {duration|s}.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.slow = { pct: c.tune().pct, duration: c.tune().duration }; } },
});
