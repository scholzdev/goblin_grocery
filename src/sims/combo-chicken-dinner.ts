import { defineSim } from './_sim';

// Combo: chickenDinner. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-chicken-dinner',
  notes: 'Chicken Dinner: every 4th pan sweep is bigger (range x1.4) and hits for x2.5. The lunchbox touches the pan.',
  cart: [
    { id: 'pan', at: [2, 1] },
    { id: 'lunchbox', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
