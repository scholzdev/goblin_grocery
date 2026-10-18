import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// What a Shortcut Key becomes once used. Never in a shop (`noShop`); sells for 1.
export default defineItem({
  id: Item.spentkey, kind: 'passive', sets: [Set.tools], shape: '1x1', price: 2, noShop: true,
  tune: { sell: 1 }, // = sellPrice('spentkey'), pinned in tests/shortcut.test.ts
  text: {
    en: { name: 'Spent Key', blurb: 'Worn smooth. Opens nothing now.', rules: 'No effect. Sell it for {sell} coin.' },
    de: { name: 'Verbrauchter Schlüssel', blurb: 'Abgegriffen. Öffnet nichts mehr.', rules: 'Keine Wirkung. Verkaufe ihn für {sell} Münze.' },
  },
});
