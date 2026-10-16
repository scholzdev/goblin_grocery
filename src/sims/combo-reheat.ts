import { defineSim } from './_sim';

// Combo: reheat. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-reheat',
  notes: 'Reheat: the first enemy a microwave zap hits is left standing in a fire pool.',
  cart: [
    { id: 'microwave', at: [2, 1] },
    { id: 'fuel', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
