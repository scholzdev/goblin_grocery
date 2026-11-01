import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-lucky-fizz',
  notes: 'Lucky Fizz: the Fortune Cookie gives the Fizz Cannon extra crit chance.',
  cart: [{ id: Item.fizz, at: [2, 1] }, { id: Item.fortune, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
