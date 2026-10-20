import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: toaster. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-toaster',
  notes: 'Toaster ★3: one toast every 0.8 s for 19.8 damage (Kitchen L2 from its own 3 set points), thrown at the nearest enemy within 455, and one more at the next nearest. Watch the volley: two toasts into the bunch, one enemy per toast, the pop sound at normal pitch.',
  cart: [{ id: Item.toaster, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [940, 480] }],
});
