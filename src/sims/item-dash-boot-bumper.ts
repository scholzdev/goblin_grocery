import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// The comparison cart for item-dash-ball: the same Pan and the same milk, the dash from Running Boot + Slam Bumper instead.
export default defineSim({
  id: 'item-dash-boot-bumper',
  notes: 'Pan ★1 + Running Boot + Slam Bumper (5 cells). Dash (Space) every 3 s: 12 damage to each milk it touches plus an 8-damage blast on landing. Compare with ?sim=item-dash-ball.',
  cart: [
    { id: Item.pan, at: [0, 0] },
    { id: Item.boot, at: [2, 0] },
    { id: Item.bumper, at: [3, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
