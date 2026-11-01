import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-magnetic-fizz',
  notes: 'Magnetic Fizz: each ricochet marks its next grocery.',
  cart: [{ id: Item.fizz, at: [2, 1] }, { id: Item.magnet, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
