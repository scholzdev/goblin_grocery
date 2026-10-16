import { defineSim } from './_sim';

// Combo: expressCheckout. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-express-checkout',
  notes: 'Express Checkout: a dash that connects makes the pan sweep once more along the dash (Space into the milk; 1 s cooldown per pan).',
  cart: [
    { id: 'pan', at: [2, 1] },
    { id: 'bell', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
