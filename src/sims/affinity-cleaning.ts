import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Element soft counters, cleaning: the Leaf Blower (cleaning only) against Expired Milk (weak to cleaning, resists poison) and milk (no cleaning affinity).
export default defineSim({
  id: 'affinity-cleaning',
  notes: 'Leaf Blower ★3 (cleaning): the cone hits for 6 and pushes hard; a blown enemy slammed into a wall also takes the slam as a cleaning hit. Expired Milk (right) is weak to cleaning: 8 per hit. Sour Milk (left) has no cleaning affinity: 6.',
  cart: [
    { id: Item.leafblower, tier: 3, at: [2, 1] },
  ],
  enemies: [
    { id: Enemy.expired, count: 4, still: true, spread: 'cluster', at: [840, 500] },
    { id: Enemy.milk, count: 4, still: true, spread: 'cluster', at: [440, 500] },
  ],
});
