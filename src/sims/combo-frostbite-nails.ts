import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: frostbiteNails. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-frostbite-nails',
  notes: 'Frostbite Nails: nails pierce one more enemy; every 3rd nail that hits an enemy freezes it for 0.7 s.',
  cart: [
    { id: Item.nailgun, at: [2, 1] },
    { id: Item.ice, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
