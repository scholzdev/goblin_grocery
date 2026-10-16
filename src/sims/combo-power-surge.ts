import { defineSim } from './_sim';

// Combo: powerSurge. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-power-surge',
  notes: 'Power Surge: every laser beam fires a weaker echo beam 0.25 s later.',
  cart: [
    { id: 'laser', at: [2, 1] },
    { id: 'powerstrip', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
