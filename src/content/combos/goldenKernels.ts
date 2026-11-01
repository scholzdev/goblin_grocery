import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Popcorn Maker + Fortune Cookie: a small, reliable crit bump gives the snack weapon a lucky damage route.
export default defineCombo({
  id: Combo.goldenKernels, requires: [Item.popcorn, Item.fortune],
  tune: { crit: 0.1 },
  text: {
    en: { name: 'Golden Kernels', short: 'Kernels can crit', summary: 'Popcorn touching a Fortune Cookie: lucky kernels hit twice as hard.', detail: 'Kernels gain {crit|+pct} crit chance.' },
    de: { name: 'Goldene Körner', short: 'Körner können kritisch treffen', summary: 'Popcorn berührt einen Glückskeks: Glückskörner treffen doppelt hart.', detail: 'Körner erhalten {crit|+pct} Kritchance.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.critChance += c.tune().crit; } },
});
