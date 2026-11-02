import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: airRaid. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-air-raid',
  notes: 'Air Raid: every 5th leaf blast stuns everything it hits for 0.5 s.',
  cart: [
    { id: Item.leafblower, at: [2, 1] },
    { id: Item.airhorn, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
