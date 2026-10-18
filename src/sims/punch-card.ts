import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// Contract: a real aisle 4 (55 groceries, Elites possible) with a Punch Card and a heat cart. Watch the banner (the goal), the sticker under the strip
// (counter, bar and ten holes), the gold card and "Punched!" when it is met, the grey card when a no-hit goal can no longer be reached, then the coins on the receipt and the free reroll in the shop.
export default defineSim({
  id: 'punch-card',
  notes: 'Punch Card: the aisle gets one goal that fits the cart (heat kills, dash kills, kills, Elites from aisle 4, no hit for 20 s). The sticker tracks it.',
  aisle: 4,
  waves: true,
  god: false,
  cart: [
    { id: Item.toaster, at: [1, 1] },
    { id: Item.fuel, at: [3, 1] },
    { id: Item.punchcard, at: [5, 3] },
  ],
});
