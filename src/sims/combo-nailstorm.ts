import { defineSim } from './_sim';

// Combo: nailstorm. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-nailstorm',
  notes: 'Nailstorm: nails pierce one more enemy and curve toward a target after the first hit.',
  cart: [
    { id: 'nailgun', at: [2, 1] },
    { id: 'magnet', at: [2, 0] },
    { id: 'battery', at: [3, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
