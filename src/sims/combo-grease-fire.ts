import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: greaseFire. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-grease-fire',
  notes: 'Grease Fire: the mop puddle is wider and its burn does double damage.',
  cart: [
    { id: Item.mop, at: [2, 1] },
    { id: Item.fuel, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
