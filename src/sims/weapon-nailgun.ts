import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: nailgun. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-nailgun',
  notes: 'Nail Gun ★3: a burst of three nails (6 damage each) every 0.88 s, 0.08 s apart, each nail aimed at the nearest enemy the burst has not aimed at yet, with a little spread. 480 range, no pierce.',
  cart: [{ id: Item.nailgun, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [960, 480] }],
});
