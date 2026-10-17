import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: chickenDinner. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-chicken-dinner',
  notes: 'Chicken Dinner: every 4th pan sweep is bigger (range x1.4) and hits for x2.5. The lunchbox touches the pan.',
  cart: [
    { id: Item.pan, at: [2, 1] },
    { id: Item.lunchbox, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
