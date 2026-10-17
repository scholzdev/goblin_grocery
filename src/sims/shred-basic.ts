import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Can Opener (★3: every direct hit shreds) next to a ★1 toaster, against Canned Beans (armor 3) and plain milk. The toaster's 9 damage shows both ends of Shred.
export default defineSim({
  id: 'shred-basic',
  notes: 'Can Opener ★3 + Toaster ★1 (9 per toast, 9.5 with the Can Opener\'s bundle bonus; the numbers on screen are rounded). Beans (armor 3): 6.5, then 7.5, 8.5, 9.5 as stacks build (each stack is -1 armor, max 3, for 4 s, they refresh together). Milk (no armor): 10.5, 11.5, 12.5: +1 per stack, but never more than half the hit (a 3-damage Nail Gun hit gets +2, see combo-crack-open). Stacks show as orange diamonds left of the health bar.',
  cart: [
    { id: Item.toaster, tier: 1, at: [2, 1] },
    { id: Item.canopener, tier: 3, at: [1, 0] },
  ],
  enemies: [
    { id: Enemy.beans, count: 4, spread: 'cluster' },
    { id: Enemy.milk, count: 4, spread: 'cluster' },
  ],
});
