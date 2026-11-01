import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Snow Cone Machine + Popcorn: crunchy ice bits spread the slush farther.
export default defineCombo({
  id: Combo.frozenKernels,
  requires: [Item.snowcone, Item.popcorn],
  tune: { rangeMult: 1.2 },
  text: {
    en: { name: 'Frozen Kernels', short: 'Snow cones reach farther', summary: 'Snow Cone Machine touching Popcorn: crunchy ice carries the chill.', detail: 'Snow Cone puddle range is increased by {rangeMult|pct}.' },
    de: { name: 'Eiskörner', short: 'Slush-Pfützen reichen weiter', summary: 'Slush-Maschine berührt Popcorn: knuspriges Eis trägt die Kälte.', detail: 'Die Reichweite der Slush-Pfütze steigt um {rangeMult|pct}.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.range *= c.tune().rangeMult; } },
});
