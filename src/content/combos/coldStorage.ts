import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Vacuum + Ice Pack: freezing suction. Replaces the Ice Pack slow (it assigns `slow`; Frost's post-combo clamp at order 1000 runs after
// it). The frost-blue look is drawn from `frostRing`.
export default defineCombo({
  id: Combo.coldStorage, requires: [Item.vacuum, Item.ice],
  tune: { pct: 0.5, duration: 1.5, damageMult: 2.5, radiusMult: 1.2 },
  text: {
    en: {
      name: 'Cold Storage', short: 'Huge freezing suction',
      summary: 'Vacuum touching an Ice Pack: freezing suction.',
      detail: 'Suction reaches {radiusMult|pctup}% farther, and its damage ticks deal {damageMult|x} damage and slow enemies {pct|pct} for {duration|s}. Replaces the Ice Pack slow (never added together).',
    },
    de: {
      name: 'Kühlhaus', short: 'Riesiger Frostsog',
      summary: 'Staubsauger berührt Kühlakku: eisiger Sog.',
      detail: 'Der Sog reicht {radiusMult|pctup}% weiter, seine Schadensticks machen {damageMult|x} Schaden und verlangsamen Gegner {duration|s} um {pct|pct}. Ersetzt die Kühlakku-Verlangsamung (nie addiert).',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.frostRing = true; w.slow = { pct: t.pct, duration: t.duration }; w.damage *= t.damageMult; w.range *= t.radiusMult;
    },
  },
});
