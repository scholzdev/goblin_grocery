import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Perishable: `age` = aisles completed in the cart (`ItemContent.age`, ageItems in state/run.ts). Aisle n in the cart is age n-1: it ripens for
// `freshAisles` aisles (+perAisle damage per aisle in the cart, sells for +sellPerAisle more each), then it is brown for good.
export default defineItem({
  id: Item.avocado, kind: 'passive', sets: [Set.snacks], shape: '1x1', price: 8,
  age: 'cart',
  tune: { perAisle: [0.1, 0.12, 0.15], freshAisles: 3, brownCut: 0.2, sellPerAisle: 4, brownSell: 1 },
  text: {
    en: { name: 'Avocado', blurb: 'Perfectly ripe for about five minutes.', rules: 'Weapons touching it gain {perAisle|+pct} damage per aisle in the cart (up to {freshAisles|int} aisles) and it sells for {sellPerAisle|int} more coins each aisle. After that it is brown for good: touching weapons deal {brownCut|pct} less damage and it sells for {brownSell|int}.' },
    de: { name: 'Avocado', blurb: 'Etwa fünf Minuten lang perfekt reif.', rules: 'Angrenzende Waffen erhalten {perAisle|+pct} Schaden pro Gang im Wagen (bis zu {freshAisles|int} Gänge), und der Verkaufswert steigt jeden Gang um {sellPerAisle|int} Münzen. Danach ist sie für immer braun: Angrenzende Waffen richten {brownCut|pct} weniger Schaden an, und sie bringt {brownSell|int}.' },
  },
  rows: [{ label: { en: 'Damage / aisle', de: 'Schaden / Gang' }, key: 'perAisle', fmt: '+pct' }],
  look: (i, t) => ((i.age ?? 0) >= t.freshAisles ? 'rotten' : null),
  sellValue: (base, i, t) => ((i.age ?? 0) >= t.freshAisles ? t.brownSell : base + t.sellPerAisle * (i.age ?? 0)),
  build: {
    // global-mod, like Sourdough: per instance with its own effective tier; `c.tune()` would be the best copy in the cart.
    phase: 'global-mod', order: 20,
    weapon(w, c) {
      const { freshAisles, brownCut } = c.tune();
      for (const n of c.touching(w)) {
        const age = n.instance.age ?? 0;
        w.damage *= age >= freshAisles ? 1 - brownCut : 1 + c.tuneOf(Item.avocado, n.tier).perAisle * (age + 1);
      }
    },
  },
});
