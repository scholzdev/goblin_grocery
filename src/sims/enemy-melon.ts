import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: melon. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour. Mortal where the behaviour needs a death.
export default defineSim({
  id: 'enemy-melon',
  notes: 'Watermelon (60 HP, mortal): bursts into 3 Melon Slices (5 HP, speed 95, no coins) when it dies. 50% knockback resist.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.melon, count: 6, spread: 'cluster', immortal: false },
  ],
});
