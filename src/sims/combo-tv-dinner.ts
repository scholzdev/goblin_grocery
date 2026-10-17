import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: tvDinner. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-tv-dinner',
  notes: 'TV Dinner: the microwave zap chains one more link; chain links deal 60%.',
  cart: [
    { id: Item.microwave, at: [2, 1] },
    { id: Item.lunchbox, at: [2, 0] },
    { id: Item.battery, at: [4, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
