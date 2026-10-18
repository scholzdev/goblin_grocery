import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Pan + Bowling Ball with 12 Piggy Banks as 1-cell filler (neutral items) to reach a 19-cell cart. Compare with item-dash-boot-bumper.
export default defineSim({
  id: 'item-dash-ball',
  notes: 'Pan ★1 + Bowling Ball ★1 + 12 Piggy Banks as filler (19 cells). Dash (Space) every 3 s: 6 + 19 = 25 damage to each milk it touches, knockback +50%, you move 9.5% slower. Compare with ?sim=item-dash-boot-bumper.',
  cart: [
    { id: Item.pan, at: [0, 0] },
    { id: Item.bowlingball, at: [2, 0] },
    ...[[4, 0], [5, 0], [6, 0], [4, 1], [5, 1], [6, 1], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3]].map(([x, y]) => ({ id: Item.piggy, at: [x, y] as [number, number] })),
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
