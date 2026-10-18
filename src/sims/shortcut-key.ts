import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// Shortcut: starts in the cart editor before aisle 3 holding a Shortcut Key. Leave the shop: the door screen has a Staff Only door as its last card.
// Take it: aisle 3 is skipped (no fight, no coins, no shop), you heal to full and land in aisle 4 (the mini-boss aisle). The key is now a Spent Key (sells for 1).
export default defineSim({
  id: 'shortcut-key',
  notes: 'Shortcut Key: leave the shop and take the Staff Only door. Aisle 3 is skipped, HP is full, the key turns into a Spent Key.',
  aisle: 3,
  waves: true,
  start: 'shop',
  god: false,
  hp: 8,
  cart: [
    { id: Item.toaster, at: [1, 1] },
    { id: Item.shortcut, at: [5, 3] },
  ],
});
