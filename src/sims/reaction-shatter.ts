import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Shatter: burn + frosted. A Toaster with a Fuel Can burns every toast and an Ice Pack on the same Toaster slows it, so every toast puts both on a milk.
export default defineSim({
  id: 'reaction-shatter',
  notes: 'Shatter: a Toaster with a Fuel Can (burn) and an Ice Pack (frost slow). The first toast that leaves both on a milk shatters it: a teal SHATTER! pops up and a burst of 8 + half the toast\'s damage hits it, in teal. The burn and the slow are eaten. Each enemy reacts at most once per second, so it takes a few toasts to see it again. Walking milk, so the slow shows.',
  cart: [
    { id: Item.toaster, tier: 1, at: [1, 1] },
    { id: Item.fuel, at: [3, 1] },
    { id: Item.ice, at: [1, 2] },
  ],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
