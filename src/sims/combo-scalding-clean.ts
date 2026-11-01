import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-scalding-clean',
  notes: 'Scalding Clean: hot mop puddles ignite groceries when they step in.',
  cart: [{ id: Item.mop, at: [2, 1] }, { id: Item.hotsauce, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
