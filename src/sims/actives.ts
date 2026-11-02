import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// The four former actives, now automatic triggers, in one cart.
export default defineSim({
  id: 'actives',
  notes: 'Automatic triggers: Air Horn blows once 8 enemies are within 150 of the cart, the Fire Extinguisher blasts the nearest enemy every 6 s, Bubble Wrap pops the first time a hit leaves you under 50% HP, and every 3rd dash fires the Vacuum\'s Full Suck. Dash with Space.',
  cart: [
    { id: Item.vacuum, at: [0, 0] },
    { id: Item.bubblewrap, at: [4, 0] },
    { id: Item.airhorn, at: [4, 1] },
    { id: Item.fireextinguisher, at: [5, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster', at: [800, 480] }],
});
