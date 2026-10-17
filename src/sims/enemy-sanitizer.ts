import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Hand Sanitizer: a status cart (a Toaster with a Fuel Can for burn and a Can Opener for shred, a Spray Bottle with Expired Milk and a Desk Fan for Sour Mist poison and Wet)
// against a crowd with two Sanitizers in it. Mortal milk so you can see the group get hurt; the Sanitizers keep scrubbing.
export default defineSim({
  id: 'enemy-sanitizer',
  notes: 'Hand Sanitizer (60 HP): every second it scrubs burn, poison, shred, wet and weaken off itself and every enemy within 120 px (a pale pulse ring, a sparkle on whoever got cleaned). Slow, stun and marks stay. The cart burns (Toaster + Fuel Can), shreds (Can Opener), poisons and soaks (Sour Mist Spray Bottle): watch the status markers vanish near the Sanitizers and stay on the milk further away. Blast is its weakness, poison it resists.',
  god: true,
  cart: [
    { id: Item.toaster, tier: 1, at: [0, 0] },
    { id: Item.fuel, at: [2, 0] },
    { id: Item.canopener, tier: 2, at: [0, 1] },
    { id: Item.spray, tier: 1, at: [4, 0] },
    { id: Item.expiredmilk, at: [4, 2] },
    { id: Item.fan, at: [5, 0] },
  ],
  enemies: [
    { id: Enemy.sanitizer, count: 2, spread: 'cluster', at: [1000, 420] },
    { id: Enemy.milk, count: 6, spread: 'cluster', at: [960, 420] },
  ],
});
