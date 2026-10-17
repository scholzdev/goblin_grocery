import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// The armor pass: the Frozen Turkey now has armor 2 (the Self-Checkout Kiosk 3, the Walk-In Freezer 2). A Nail Gun has no element the Turkey or a Banana cares about,
// so 6 per nail is the plain hit, and the armor is the only thing between the two groups.
export default defineSim({
  id: 'armor-turkey',
  notes: 'Nail Gun ★3 (blast): 6 per nail. Banana Bandit (no armor, no blast affinity): 6. Frozen Turkey (150 HP, armor 2): 4 per nail, 2 soaked off every direct hit but never more than 70% of it. Burn, puddles and auras ignore the armor. The codex shows the armor chip. F8, then add a Can Opener next to the nail gun: two Shred stacks open the Turkey up, a third adds damage.',
  cart: [{ id: Item.nailgun, tier: 3, at: [2, 1] }],
  enemies: [
    { id: Enemy.turkey, count: 4, still: true, spread: 'cluster', at: [840, 500] },
    { id: Enemy.banana, count: 4, still: true, spread: 'cluster', at: [440, 500] },
  ],
});
