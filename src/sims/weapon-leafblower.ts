import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: leafblower. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-leafblower',
  notes: 'Leaf Blower ★3: every 0.72 s a 50° cone (253 reach: Cleaning L2 from its own 3 set points) for 6 and a heavy push. Blown enemies that hit a wall or prop take 16 slam damage. The bunch stands next to the right wall: watch them get slammed into it.',
  cart: [{ id: Item.leafblower, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [1100, 480] }],
});
