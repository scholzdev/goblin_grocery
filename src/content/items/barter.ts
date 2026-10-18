import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Selling pays `rate` of an item's value instead of {base|pct} (`sellPrice` in systems/shop reads `build.sellRate`). The best copy counts.
export default defineItem({
  id: Item.barter, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 10,
  tune: { rate: [0.65, 0.75, 0.85], base: 0.5 }, // `base` is the plain sell rate, for the text (systems/shop `sellPrice`)
  text: {
    en: { name: 'Barter Stamp', blurb: 'Stamped, haggled, sold.', rules: 'Selling items pays {rate|pct} of their value instead of {base|pct} (does not stack).' },
    de: { name: 'Tauschstempel', blurb: 'Abgestempelt, gefeilscht, verkauft.', rules: 'Verkäufe zahlen {rate|pct} des Werts statt {base|pct} (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Sell value', de: 'Verkaufswert' }, key: 'rate', fmt: 'pct' }],
  build: {
    phase: 'final',
    player(b, c) { b.sellRate = Math.max(b.sellRate, c.tune().rate); },
  },
});
