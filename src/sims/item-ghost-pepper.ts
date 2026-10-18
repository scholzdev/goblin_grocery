import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Ghost Pepper: heat hits +50% and every hit you take sets you on fire. God mode is off so the milk can hurt you.
export default defineSim({
  id: 'item-ghost-pepper',
  notes: 'Ghost Pepper ★1: Toaster + Fuel Can burn +50%. Each hit you take burns you for 1.5 dps over 2 s (BURNING over the goblin; no hurt flinch, no i-frames, never below 1 HP). Let the milk reach you.',
  god: false,
  cart: [
    { id: Item.toaster, at: [0, 0] },
    { id: Item.fuel, at: [2, 0] },
    { id: Item.ghostpepper, at: [0, 2] },
  ],
  enemies: [{ id: Enemy.milk, count: 3, spread: 'cluster' }],
});
