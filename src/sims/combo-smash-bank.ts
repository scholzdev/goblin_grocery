import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: smashBank. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-smash-bank',
  notes: 'Smash the Bank: every enemy the pan hits has a 15% chance to drop a coin.',
  cart: [
    { id: Item.pan, at: [2, 1] },
    { id: Item.piggy, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
