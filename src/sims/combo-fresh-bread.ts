import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: freshBread. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-fresh-bread',
  notes: 'Fresh Bread: toast pierces one more enemy, two once the Sourdough has fully risen. Sourdough is at ★3 here, so two.',
  cart: [
    { id: Item.toaster, at: [2, 1] },
    { id: Item.sourdough, tier: 3, at: [4, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
