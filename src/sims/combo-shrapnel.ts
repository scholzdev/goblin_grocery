import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: shrapnel. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-shrapnel',
  notes: 'Shrapnel: each pressure cooker blast sends 6 nails out in a ring (tape touches the cooker).',
  cart: [
    { id: Item.cooker, at: [2, 1] },
    { id: Item.tape, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
