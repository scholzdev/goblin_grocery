import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: reheat. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-reheat',
  notes: 'Reheat: the first enemy a microwave zap hits is left standing in a fire pool.',
  cart: [
    { id: Item.microwave, at: [2, 1] },
    { id: Item.fuel, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
