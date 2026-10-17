import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: smoothieShield. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-smoothie-shield',
  notes: 'Smoothie Shield: the blender destroys enemy projectiles inside its radius. The spitters shoot at you.',
  cart: [
    { id: Item.blender, at: [2, 1] },
    { id: Item.bubblewrap, at: [0, 0] },
  ],
  enemies: [{ id: Enemy.spitter, count: 3, still: false }, { id: Enemy.milk, count: 4, spread: 'cluster' }],
});
