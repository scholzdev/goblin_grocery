import { defineSim } from './_sim';

// Combo: shrapnel. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-shrapnel',
  notes: 'Shrapnel: each pressure cooker blast sends 6 nails out in a ring (tape touches the cooker).',
  cart: [
    { id: 'cooker', at: [2, 1] },
    { id: 'tape', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
