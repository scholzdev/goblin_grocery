import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: priceDrop. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-price-drop',
  notes: 'Price Drop: laser kills roll an extra coin at 2x the Coupon Book chance.',
  cart: [
    { id: Item.laser, at: [2, 1] },
    { id: Item.coupon, at: [1, 2] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
