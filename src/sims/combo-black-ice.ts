import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: blackIce. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-black-ice',
  notes: 'Black Ice: an enemy that steps into a mop puddle is frozen for 0.8 s on its first tick.',
  cart: [
    { id: Item.mop, at: [2, 1] },
    { id: Item.ice, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
