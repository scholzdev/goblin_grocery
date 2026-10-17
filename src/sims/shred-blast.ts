import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Explosions shred on their own, no Can Opener: the Pressure Cooker's blast is a `blast` hit and leaves one stack on everything it hits.
export default defineSim({
  id: 'shred-blast',
  notes: 'Pressure Cooker ★1 (16 per blast, every 2.6 s). Every blast leaves 1 Shred stack. Beans (armor 3): 13, then 14, 15, 16 with each blast. Banana (no armor, no heat or blast affinity): 16, 17, 18, 19. Popper pops, Bag It and the egg blast shred too.',
  cart: [{ id: Item.cooker, tier: 1, at: [2, 1] }],
  enemies: [
    { id: Enemy.beans, count: 4, spread: 'cluster', still: true },
    { id: Enemy.banana, count: 4, spread: 'cluster', still: true },
  ],
});
