import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Electric L3 (four electrical items). The battery touches the nail gun and the laser.
export default defineSim({
  id: 'electric-l3',
  notes: 'Electric L3: nail gun, vacuum, battery, laser.',
  cart: [
    { id: Item.nailgun, at: [0, 0] },
    { id: Item.battery, at: [2, 0] },
    { id: Item.laser, at: [2, 0] },
    { id: Item.vacuum, at: [0, 1], rot: 1 },
  ],
  enemies: [{ id: Enemy.cereal, count: 8, spread: 'cluster' }],
});
