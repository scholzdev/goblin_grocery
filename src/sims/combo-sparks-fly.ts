import { defineSim } from './_sim';

// Combo: sparksFly. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-sparks-fly',
  notes: 'Sparks Fly: the microwave chains two more links; the last two deal 50%, and each chain hit has a 25% chance to stun.',
  cart: [
    { id: 'microwave', at: [2, 1] },
    { id: 'tinfoilhat', at: [3, 0] },
    { id: 'battery', at: [4, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
