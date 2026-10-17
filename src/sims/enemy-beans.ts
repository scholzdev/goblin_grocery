import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: beans. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-beans',
  notes: 'Canned Beans (40 HP): armor 3 soaks 3 damage off every direct hit, but never more than 70% of it (at least 30% still lands). Burn ticks, puddles and auras ignore the tin. Compare the pan and toaster numbers with the milk sim.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.beans, count: 8, spread: 'cluster' },
  ],
});
