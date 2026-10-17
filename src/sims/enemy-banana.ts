import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: banana. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-banana',
  notes: 'Banana Bandit (12 HP): inside 260 px it winds up for 0.6 s (the peeling sprite), then lunges 430 px/s for 0.38 s in a straight line, 5 damage on contact, then recovers. The lunge stops at props and walls. Sidestep it.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.banana, count: 6 },
  ],
});
