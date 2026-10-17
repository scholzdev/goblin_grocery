import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: expired. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-expired',
  notes: 'Expired Milk (28 HP): every 4 s it flickers for 0.6 s (a dashed ring marks the spot), then blinks to a point 110 px from you, clear of props. 6 damage on contact.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.expired, count: 6 },
  ],
});
