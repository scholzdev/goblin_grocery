import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: baguette. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-baguette',
  notes: 'Baguette Bruiser (34 HP): within 92 reach it winds up 0.55 s (a red arc shows the 110° swing), then swings for 7 damage, every 2.2 s. 30% knockback resist.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.baguette, count: 6, spread: 'cluster' },
  ],
});
