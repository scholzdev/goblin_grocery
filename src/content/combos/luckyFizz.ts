import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Fizz Cannon + Fortune Cookie: a lucky cap gives the soda a reliable critical edge.
export default defineCombo({
  id: Combo.luckyFizz, requires: [Item.fizz, Item.fortune],
  tune: { crit: 0.08 },
  text: {
    en: {
      name: 'Lucky Fizz', short: '+crit chance',
      summary: 'Fizz Cannon touching a Fortune Cookie: lucky numbers in every can.',
      detail: 'The Fizz Cannon gains {crit|+pct1} critical-hit chance.',
    },
    de: {
      name: 'Glücksbrause', short: '+Kritchance',
      summary: 'Sprudelkanone berührt Glückskeks: Glückszahlen in jeder Dose.',
      detail: 'Die Sprudelkanone erhält {crit|+pct1} Kritchance.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { w.critChance += c.tune().crit; },
  },
});
