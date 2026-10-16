import { defineSim } from './_sim';

// Combo: rayGun. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-ray-gun',
  notes: 'Ray Gun: the nail gun fires energy bolts with splash; every 3rd bolt is a big red one. (Replaces Nailstorm.)',
  cart: [
    { id: 'nailgun', at: [2, 1] },
    { id: 'battery', at: [2, 0] },
    { id: 'tinfoilhat', at: [3, 0] },
    { id: 'magnet', at: [1, 1] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
