import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: nailstorm. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-nailstorm',
  notes: 'Nailstorm: nails pierce one more enemy and curve toward a target after the first hit.',
  cart: [
    { id: Item.nailgun, at: [2, 1] },
    { id: Item.magnet, at: [2, 0] },
    { id: Item.battery, at: [3, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
