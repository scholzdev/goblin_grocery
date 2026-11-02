import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: sporeStorm. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-spore-storm',
  notes: 'Spore Storm: every blast leaves a Moldy Bread spore cloud where its cone ends.',
  cart: [
    { id: Item.leafblower, at: [2, 1] },
    { id: Item.moldybread, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
