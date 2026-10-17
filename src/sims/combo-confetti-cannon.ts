import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: confettiCannon. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-confetti-cannon',
  notes: 'Confetti Cannon: every ricochet cap pops a confetti blast. Stand where the fizz shots bounce off the cluster.',
  cart: [
    { id: Item.fizz, at: [2, 1] },
    { id: Item.popper, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
