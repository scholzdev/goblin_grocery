import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: egg. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour. Mortal where the behaviour needs a death.
export default defineSim({
  id: 'enemy-egg',
  notes: 'Egg Carton (30 HP, mortal): inside 70 px it winds up 0.7 s (a red ring shows the 90 px blast), then explodes: 8 damage to you, 12 to every other grocery in the ring. It dies with no kill credit. F9 for a fresh batch.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.egg, count: 6, immortal: false },
  ],
});
