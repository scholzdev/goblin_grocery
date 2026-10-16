import { defineSim } from './_sim';

// Combo: blackIce. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-black-ice',
  notes: 'Black Ice: an enemy that steps into a mop puddle is frozen for 0.8 s on its first tick.',
  cart: [
    { id: 'mop', at: [2, 1] },
    { id: 'ice', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
