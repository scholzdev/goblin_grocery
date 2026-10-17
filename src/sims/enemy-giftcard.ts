import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: giftcard. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour. Mortal where the behaviour needs a death.
export default defineSim({
  id: 'enemy-giftcard',
  notes: 'Gift Card (30 HP, speed 120, mortal): runs away from you, off the walls, a little sideways. A real one escapes after 8 s (dummies never do). A kill pays 8x coins and every coin drops.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.giftcard, count: 6, immortal: false },
  ],
});
