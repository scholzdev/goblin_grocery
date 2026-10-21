import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: spray. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-spray',
  notes: 'Spray Bottle ★3: every 0.44 s a 70° cone (195.5 reach: Cleaning L1 from its own 3 set points) for 6 on every enemy inside, a light push of 40; enemy shots inside the cone are washed away. Short range: the bunch starts close in front of the cart.',
  cart: [{ id: Item.spray, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster', at: [820, 480] }],
});
