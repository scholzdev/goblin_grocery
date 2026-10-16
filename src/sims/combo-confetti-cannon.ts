import { defineSim } from './_sim';

// Combo: confettiCannon. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-confetti-cannon',
  notes: 'Confetti Cannon: every ricochet cap pops a confetti blast. Stand where the fizz shots bounce off the cluster.',
  cart: [
    { id: 'fizz', at: [2, 1] },
    { id: 'popper', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
