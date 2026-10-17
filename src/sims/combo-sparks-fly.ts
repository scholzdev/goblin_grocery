import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: sparksFly. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-sparks-fly',
  notes: 'Sparks Fly: the microwave chains two more links; the last two deal 50%, and each chain hit has a 25% chance to stun.',
  cart: [
    { id: Item.microwave, at: [2, 1] },
    { id: Item.tinfoilhat, at: [3, 0] },
    { id: Item.battery, at: [4, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
