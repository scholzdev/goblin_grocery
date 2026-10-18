import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: thunderstorm. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-thunderstorm',
  notes: 'Thunderstorm: blasts soak enemies for 2 s; every 3rd blast first strikes up to 4 already-Wet enemies for 50% blast damage.',
  cart: [
    { id: Item.leafblower, at: [2, 1] },
    { id: Item.fan, at: [1, 0] },
    { id: Item.battery, at: [2, 0] },
    { id: Item.ice, at: [4, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
