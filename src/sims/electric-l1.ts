import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Electric L1 (two electrical items): the baseline for electric-l3.
export default defineSim({
  id: 'electric-l1',
  notes: 'Electric L1: nail gun + vacuum.',
  cart: [
    { id: Item.nailgun, at: [0, 0] },
    { id: Item.vacuum, at: [0, 1] },
  ],
  enemies: [{ id: Enemy.cereal, count: 8, spread: 'cluster' }],
});
