import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: snowBlower. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-snow-blower',
  notes: 'Snow Blower: every leaf blast drops a Snow Cone slush puddle where its cone ends.',
  cart: [
    { id: Item.leafblower, at: [2, 1] },
    { id: Item.snowcone, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
