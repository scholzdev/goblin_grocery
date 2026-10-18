import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Bowling Ball: dash damage per occupied cart cell, more knockback, slower. The Balloon beside the Ball makes the Ball's own cells weightless for the slow.
export default defineSim({
  id: 'item-bowling-ball',
  notes: 'Bowling Ball ★1 + Helium Balloon + Running Boot: dash (Space) damage = 6 + 6 (Boot) + 1 per occupied cart cell, and +50% knockback. The Balloon touches the Ball, so the Ball\'s 4 cells do not slow you; the Balloon adds +10% speed.',
  cart: [
    { id: Item.toaster, at: [0, 0] },
    { id: Item.bowlingball, at: [0, 1] },
    { id: Item.balloon, at: [2, 1] },
    { id: Item.boot, at: [3, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
