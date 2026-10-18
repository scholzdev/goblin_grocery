import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Bound to a family when bought (`ItemInstance.binderFamily`, set by state/run.ts `newBinder`): the family the cart and shelf hold the most of.
// Items of that family sell at full value (`build.sellFullFamilies`). Every sale of one counts on the instance (`binderSold`), and each
// sale adds `perSell` damage to the family's weapons, up to `cap`. Two Binders on one family do not add up: the better one counts.
export default defineItem({
  id: Item.binder, kind: 'passive', sets: [Set.checkout], shape: '1x2', price: 14,
  tune: { perSell: 0.02, cap: 0.2 },
  text: {
    en: { name: 'Collector\'s Binder', blurb: 'Gotta sell \'em all.', rules: 'Bound to the family you own the most items of when you buy it. Items of that family sell at full value, and each one you sell adds {perSell|pct} damage to that family\'s weapons (up to {cap|pct}).' },
    de: { name: 'Sammelmappe', blurb: 'Muss man alle verkaufen.', rules: 'Bindet sich beim Kauf an die Familie, von der du die meisten Gegenstände besitzt. Gegenstände dieser Familie verkaufen sich zum vollen Wert, und jeder verkaufte erhöht den Schaden der Waffen dieser Familie um {perSell|pct} (bis {cap|pct}).' },
  },
  rows: [{ label: { en: 'Damage per sale', de: 'Schaden pro Verkauf' }, key: 'perSell', fmt: 'pct' }],
  build: {
    phase: 'final',
    weapon(w, c) {
      const { perSell, cap } = c.tune();
      const best = Math.max(0, ...c.cart.placed.filter((i) => i.type === Item.binder && i.binderFamily === c.def(w.type).family).map((i) => Math.min(cap, (i.binderSold ?? 0) * perSell)));
      w.damage *= 1 + best;
    },
    player(b, c) {
      for (const i of c.cart.placed) if (i.type === Item.binder && i.binderFamily && !b.sellFullFamilies.includes(i.binderFamily)) b.sellFullFamilies.push(i.binderFamily);
    },
  },
});
