import { defineSim } from './_sim';

// Combo: pressurePoint. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-pressure-point',
  notes: 'Pressure Point: the pressure cooker blast leaves a fire pool.',
  cart: [
    { id: 'cooker', at: [2, 1] },
    { id: 'fuel', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
