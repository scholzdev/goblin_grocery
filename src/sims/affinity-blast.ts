import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Element soft counters, blast: the Nail Gun (blast) against milk and eggs (weak to blast) and a bunch of bananas (no blast affinity).
export default defineSim({
  id: 'affinity-blast',
  notes: 'Nail Gun ★3 (blast): three nails of 6 per burst. Sour Milk and Egg Carton are weak to blast: 8 per nail. Banana Bandit has no blast affinity: 6. The eggs stand still so they do not blow up on the cart.',
  cart: [
    { id: Item.nailgun, tier: 3, at: [2, 1] },
  ],
  enemies: [
    { id: Enemy.milk, count: 4, still: true, spread: 'cluster', at: [900, 330] },
    { id: Enemy.egg, count: 4, still: true, spread: 'cluster', at: [900, 500] },
    { id: Enemy.banana, count: 4, still: true, spread: 'cluster', at: [900, 670] },
  ],
});
