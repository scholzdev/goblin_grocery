import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: staticCling. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-static-cling',
  notes: 'Static Cling: each vacuum pulse zaps 3 random enemies inside it for 150% damage.',
  cart: [
    { id: Item.vacuum, at: [2, 1] },
    { id: Item.battery, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
