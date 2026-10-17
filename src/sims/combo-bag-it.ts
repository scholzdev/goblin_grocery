import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: bagIt. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-bag-it',
  notes: 'Bag It: each vacuum kill adds a charge (BAG xN, max 10); dash (Space) to drop a bag that blasts for 6 per charge. Dummies are mortal.',
  cart: [
    { id: Item.vacuum, at: [2, 1] },
    { id: Item.doublebag, at: [1, 0] },
    { id: Item.boot, at: [3, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 12, spread: 'cluster', immortal: false }],
});
