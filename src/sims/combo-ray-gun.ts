import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: rayGun. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-ray-gun',
  notes: 'Ray Gun: the nail gun fires energy bolts with splash; every 3rd bolt is a big red one. (Replaces Nailstorm.)',
  cart: [
    { id: Item.nailgun, at: [2, 1] },
    { id: Item.battery, at: [2, 0] },
    { id: Item.tinfoilhat, at: [3, 0] },
    { id: Item.magnet, at: [1, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
