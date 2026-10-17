import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: sizzlingSkillet. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-sizzling-skillet',
  notes: 'Sizzling Skillet: every pan sweep leaves three fire pools in front of you.',
  cart: [
    { id: Item.pan, at: [2, 1] },
    { id: Item.fuel, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
