import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: brainFreeze. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-brain-freeze',
  notes: 'Brain Freeze: the blender is wider and slows what it touches.',
  cart: [
    { id: Item.blender, at: [2, 1] },
    { id: Item.ice, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
