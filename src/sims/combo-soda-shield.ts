import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-soda-shield',
  notes: 'Soda Shield: Bubble Wrap cushions hits after the Fizz Cannon fires.',
  cart: [{ id: Item.fizz, at: [2, 1] }, { id: Item.bubblewrap, at: [2, 0] }],
  enemies: [{ id: Enemy.spitter, count: 3, still: false }, { id: Enemy.milk, count: 4, spread: 'cluster' }],
});
