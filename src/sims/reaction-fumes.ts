import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Toxic Fumes: burn + poison. A Toaster with a Fuel Can burns, the Expired Milk aura poisons everything that walks up to the cart.
export default defineSim({
  id: 'reaction-fumes',
  notes: 'Toxic Fumes: a Toaster with a Fuel Can (burn) and Expired Milk (poison aura around the goblin). A burning milk that walks into the aura is poisoned and bursts into a green cloud: radius 60, 2 s, it poisons every OTHER enemy in it with the same poison. The burn is eaten, the poison stays. Packed milk, so the cloud spreads.',
  cart: [
    { id: Item.toaster, tier: 1, at: [1, 1] },
    { id: Item.fuel, at: [3, 1] },
    { id: Item.expiredmilk, at: [5, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
