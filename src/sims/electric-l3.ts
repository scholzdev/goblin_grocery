import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'electric-l3',
  notes: 'Electric L3: nail gun, ★2 vacuum, ★2 battery, laser.',
  cart: [
    { id: Item.nailgun, at: [0, 0] },
    { id: Item.battery, tier: 2, at: [2, 0] },
    { id: Item.laser, at: [2, 0] },
    { id: Item.vacuum, tier: 2, at: [0, 1], rot: 1 },
  ],
  enemies: [{ id: Enemy.cereal, count: 8, spread: 'cluster' }],
});
