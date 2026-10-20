import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: blender. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-blender',
  notes: 'Blender ★3: shreds every enemy within 85 (plus their radius) for 4.4 (Kitchen L2 from its own 3 set points) every 0.24 s and pulls them in a little (the ones touching the cart are pushed off), and keeps a blade ring spinning around the cart. Let the walkers come to you.',
  cart: [{ id: Item.blender, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'random' }],
});
