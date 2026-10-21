import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: popcorn. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-popcorn',
  notes: 'Popcorn Maker ★3: six kernels (6 damage each) every 1.04 s, each flying at a random enemy within 240 range (not the nearest), or at a random angle when none is in range. No pierce. A kernel that lands without a hit pops once more at the nearest enemy for half damage.',
  cart: [{ id: Item.popcorn, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [800, 480] }],
});
