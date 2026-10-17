import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: slice. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-slice',
  notes: 'Melon Slice (5 HP, speed 95): fast and fragile, worth no coins. What a Watermelon leaves behind (see enemy-melon).',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.slice, count: 10, spread: 'cluster' },
  ],
});
