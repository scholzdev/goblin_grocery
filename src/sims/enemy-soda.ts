import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: soda. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-soda',
  notes: 'Soda Six-Pack (48 HP, speed 46): the slow tank. 80% knockback resist, so pan pushes and dashes barely move it. 6 damage on contact.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.soda, count: 6, spread: 'cluster' },
  ],
});
