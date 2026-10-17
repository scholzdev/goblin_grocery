import { defineSim } from './_sim';

// Element soft counters, blast: the Nail Gun (blast + electrical) against milk and eggs (weak to blast) and a bunch of bananas (no blast or electric affinity).
export default defineSim({
  id: 'affinity-blast',
  notes: 'Nail Gun ★3 (blast and electric): three nails of 6 per burst. Sour Milk and Egg Carton are weak to blast: 8 per nail. Banana Bandit has no blast or electric affinity: 6. The eggs stand still so they do not blow up on the cart.',
  cart: [
    { id: 'nailgun', tier: 3, at: [2, 1] },
  ],
  enemies: [
    { id: 'milk', count: 4, still: true, spread: 'cluster', at: [900, 330] },
    { id: 'egg', count: 4, still: true, spread: 'cluster', at: [900, 500] },
    { id: 'banana', count: 4, still: true, spread: 'cluster', at: [900, 670] },
  ],
});
