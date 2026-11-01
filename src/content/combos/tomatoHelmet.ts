import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Tomato + Helmet: carrying the rotten weapon comes with a small defensive cap.
export default defineCombo({
  id: Combo.tomatoHelmet,
  requires: [Item.tomato, Item.helmet],
  tune: { reduction: 0.12 },
  text: {
    en: {
      name: 'Tomato Helmet', short: 'Less incoming damage',
      summary: 'Rotten Tomato touching a Cart Helmet: safety first, hygiene second.',
      detail: 'While the combo is active, incoming damage is reduced by {reduction|pctdown}%.',
    },
    de: {
      name: 'Tomatenhelm', short: 'Weniger eingehender Schaden',
      summary: 'Faule Tomate berührt Einkaufswagenhelm: Sicherheit zuerst, Hygiene später.',
      detail: 'Solange die Combo aktiv ist, wird eingehender Schaden um {reduction|pctdown}% reduziert.',
    },
  },
  hooks: {
    onPlayerHit(ev, _ctx, c) {
      ev.dmg *= 1 - c.tune().reduction;
    },
  },
});
