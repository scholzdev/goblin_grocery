import { cells, defineItem } from '../../engine/define';

export default defineItem({
  id: 'pricegun', kind: 'module', sets: ['checkout'], shape: cells('##', '#.'), price: 12, buff: 'pricegun',
  // crit chance per ★ (15% base x TIER.mult). ★2 is written as the product on purpose: 0.15 * 1.5 is 0.22499999999999998,
  // which the shop has always shown as 22% (a literal 0.225 would round to 23%).
  tune: { crit: [0.15, 0.15 * 1.5, 0.3] },
  text: {
    en: { name: 'Price Gun', blurb: 'Marks groceries 50% OFF. Critical hits!', rules: 'Adjacent weapons gain a {crit|pct} chance to crit for double damage (not burn). Combo: Clearance Sale with Fizz Cannon + Coupon Book.' },
    de: { name: 'Preisauszeichner', blurb: 'Zeichnet Gegner mit 50% RABATT aus. Volltreffer!', rules: 'Angrenzende Waffen erhalten {crit|pct} Chance auf einen kritischen Treffer mit doppeltem Schaden (nicht Brand). Combo: Räumungsverkauf mit Sprudelkanone + Couponheft.' },
  },
  rows: [{ label: { en: 'Crit chance', de: 'Kritchance' }, key: 'crit', fmt: 'pct' }],
  build: {
    phase: 'module', order: 60,
    // Assigns (not adds): Fortune Cookie (content/items/fortune.ts) adds its cart-wide crit on top later, in post-combo.
    weapon(w, c) { w.critChance = c.tune().crit; },
  },
});
