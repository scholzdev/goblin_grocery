import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'rotten-tomato',
  notes: 'Rotten Tomato ★3: tag groceries and watch the poison finish them. Death spreads the remaining poison once. F8 opens the cart: swap in the ★1 tomato from the shelf to compare. F9 resets the test.',
  cart: [{ id: Item.tomato, tier: 3, at: [1, 1] }],
  shelf: [{ id: Item.tomato, tier: 1 }],
  enemies: [
    { id: Enemy.milk, count: 12, spread: 'cluster', at: [850, 470], still: true, immortal: false },
    { id: Enemy.banana, count: 5, spread: 'ring', still: true, immortal: false },
  ],
});
