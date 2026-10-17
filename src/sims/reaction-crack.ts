import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Crack: Shred at the cap + a blast hit. Pressure Cooker blasts shred (1 stack each) and the Can Opener adds more; the Party Popper pops the kills.
export default defineSim({
  id: 'reaction-crack',
  notes: 'Crack: a Pressure Cooker (every blast leaves 1 Shred stack) with a Can Opener (more stacks) and a Party Popper. A blast on a Beans with 3 Shred stacks cracks it: CRACK! throws shrapnel at the 3 nearest others within 90 px (half the blast each, teal, +1 Shred) and its stacks are eaten. Beans die here (not immortal), so the Popper\'s pops add blast hits too.',
  cart: [
    { id: Item.cooker, tier: 1, at: [2, 1] },
    { id: Item.canopener, tier: 3, at: [1, 1] },
    { id: Item.popper, at: [2, 2] },
  ],
  enemies: [{ id: Enemy.beans, count: 10, spread: 'cluster', immortal: false }],
});
