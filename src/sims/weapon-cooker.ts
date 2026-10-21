import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: cooker. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-cooker',
  notes: 'Pressure Cooker ★3: every 2.08 s lobs a pot at the densest group within 420; it explodes for 35.2 (Kitchen L1 from its own 3 set points) to everything within 90, with knockback. The big bunch on the right wins the pot; a second pot at half damage and radius goes to the densest group that blast misses.',
  cart: [{ id: Item.cooker, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 9, spread: 'cluster', at: [960, 380] }, { id: Enemy.milk, count: 3, spread: 'cluster', at: [400, 600] }],
});
