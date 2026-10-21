import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'shred-tools-dash',
  notes: 'Tools L3: dash (Space) into the beans. Each dash hit stuns 0.45 s and leaves 3 Shred stacks (L2: 2), so the armor is gone for 4 s. The nail gun alone does not shred. Watch the diamonds left of the health bars.',
  cart: [
    { id: Item.nailgun, tier: 1, at: [2, 1] },
    { id: Item.magnet, tier: 2, at: [0, 0] },
    { id: Item.boot, tier: 2, at: [0, 3] },
    { id: Item.tape, at: [4, 1] },
  ],
  enemies: [{ id: Enemy.beans, count: 6, spread: 'cluster', still: true }],
});
