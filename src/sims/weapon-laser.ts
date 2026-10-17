import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: laser. The weapon alone in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-laser',
  notes: 'Self-Checkout Laser (legendary): every 1.6 s one 620-long beam that hits every enemy on the line once for 20. It aims down the line that crosses the most enemies, not just at the nearest one.',
  cart: [{ id: Item.laser, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [900, 500] }, { id: Enemy.milk, count: 5, spread: 'ring' }],
});
