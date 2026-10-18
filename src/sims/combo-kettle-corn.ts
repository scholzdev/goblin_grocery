import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: kettleCorn. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-kettle-corn',
  notes: 'Kettle Corn: a kill by a popcorn kernel scatters 3 more kernels from the corpse (they never scatter again). The popper adds its confetti to the first kill. Dummies are mortal.',
  cart: [
    { id: Item.popcorn, at: [2, 1] },
    { id: Item.popper, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 12, spread: 'cluster', immortal: false }],
});
