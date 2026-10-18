import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: fireworksShow. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-fireworks-show',
  notes: 'Fireworks Show: each pressure cooker blast also sets off 6 small blasts in a ring of 110 around it (sparklers touch the cooker).',
  cart: [
    { id: Item.cooker, at: [2, 1] },
    { id: Item.sparklers, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
