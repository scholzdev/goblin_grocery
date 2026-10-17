import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: tailwind. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-tailwind',
  notes: 'Tailwind: the leaf blower pushes you +30% for 0.4 s while moving, and feeds Sugar Rush (the energy drink and boots) at most every 1.5 s. Walk while it blows.',
  cart: [
    { id: Item.leafblower, at: [2, 1] },
    { id: Item.fan, at: [1, 0] },
    { id: Item.boot, at: [2, 0] },
    { id: Item.energy, at: [3, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
