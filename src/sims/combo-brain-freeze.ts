import { defineSim } from './_sim';

// Combo: brainFreeze. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-brain-freeze',
  notes: 'Brain Freeze: the blender is wider and slows what it touches.',
  cart: [
    { id: 'blender', at: [2, 1] },
    { id: 'ice', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
