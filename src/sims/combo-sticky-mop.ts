import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-sticky-mop',
  notes: 'Sticky Mop: puddles mark the groceries that cross them.',
  cart: [{ id: Item.mop, at: [2, 1] }, { id: Item.magnet, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
