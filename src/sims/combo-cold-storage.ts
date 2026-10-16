import { defineSim } from './_sim';

// Combo: coldStorage. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-cold-storage',
  notes: 'Cold Storage: the vacuum pulse leaves a frost ring and slows what it hits (2.5x damage, wider).',
  cart: [
    { id: 'vacuum', at: [2, 1] },
    { id: 'ice', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
