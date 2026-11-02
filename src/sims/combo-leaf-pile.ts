import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: leafPile. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-leaf-pile',
  notes: 'Leaf Pile: a blast that hits a burning enemy spreads the strongest burn to everyone near a burning one.',
  cart: [
    { id: Item.leafblower, at: [2, 1] },
    { id: Item.fuel, at: [4, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
