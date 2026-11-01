import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'weapon-tomato',
  notes: 'Rotten Tomato ★3: 4 impact damage every 0.8 s, plus 15 poison damage per second for 6 s. Prefers unpoisoned groceries. These dummies are immortal; use the rotten-tomato sim to see poison spread on death.',
  cart: [{ id: Item.tomato, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [800, 480] }],
});
