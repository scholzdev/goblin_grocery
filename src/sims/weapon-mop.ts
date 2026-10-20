import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: mop. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-mop',
  notes: 'Mop ★3: drops a soap puddle (radius 69, lasts 8 s: 3 s plus 1 s from Cleaning L2 of its own 3 set points, doubled at ★3) behind the cart every 1.28 s, even with nobody around. Enemies inside are slowed 35% (Frost L2) and take 6 every 0.5 s. Walk around: the puddles trail behind you.',
  cart: [{ id: Item.mop, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'random' }],
});
