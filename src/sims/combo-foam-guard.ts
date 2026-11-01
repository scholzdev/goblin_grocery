import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-foam-guard',
  notes: 'Foam Guard: sticky mop puddles weaken groceries that enter them.',
  cart: [{ id: Item.mop, at: [2, 1] }, { id: Item.bubblewrap, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
