import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: snowcone. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-snowcone',
  notes: 'Snow Cone Machine ★3: a slush puddle (radius 65, 4 s) behind the cart every 1.6 s. Enemies inside get Wet, a 35% slow and a 4.5 damage frost tick every 0.5 s, and freeze for 0.5 s on their first step into each puddle; it sets up Ice Sheet for the next frost hit from another source.',
  cart: [{ id: Item.snowcone, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.baguette, count: 8, spread: 'cluster', at: [800, 480] }],
});
