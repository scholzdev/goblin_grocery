import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: slushie. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-slushie',
  notes: 'Slushie: each cap hit after the first slows 10% more; the last hit of a cap freezes the enemy for 0.5 s (2.5 s cooldown per enemy).',
  cart: [
    { id: Item.fizz, at: [2, 1] },
    { id: Item.ice, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
