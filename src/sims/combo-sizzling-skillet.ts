import { defineSim } from './_sim';

// Combo: sizzlingSkillet. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-sizzling-skillet',
  notes: 'Sizzling Skillet: every pan sweep leaves three fire pools in front of you.',
  cart: [
    { id: 'pan', at: [2, 1] },
    { id: 'fuel', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
