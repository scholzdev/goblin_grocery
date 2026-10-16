import { defineSim } from './_sim';

// Combo: tailwind. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-tailwind',
  notes: 'Tailwind: the leaf blower pushes you +30% for 0.4 s while moving, and feeds Sugar Rush (the energy drink and boots) at most every 1.5 s. Walk while it blows.',
  cart: [
    { id: 'leafblower', at: [2, 1] },
    { id: 'fan', at: [1, 0] },
    { id: 'boot', at: [2, 0] },
    { id: 'energy', at: [3, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
