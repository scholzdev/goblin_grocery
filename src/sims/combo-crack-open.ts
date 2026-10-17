import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: crackOpen. The parts are placed explicitly so every adjacency the recipe needs is met. Beans (armored) instead of milk, so the stacks show.
export default defineSim({
  id: 'combo-crack-open',
  notes: 'Crack Open: every 3rd nail that hits the same enemy adds 2 Shred stacks on top of the Can Opener\'s own roll (50% at ★1). Beans (armor 3) take 1 from a 3-damage nail until the stacks build.',
  cart: [
    { id: Item.nailgun, at: [2, 1] },
    { id: Item.canopener, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.beans, count: 8, spread: 'cluster' }],
});
