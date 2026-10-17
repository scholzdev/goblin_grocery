import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Snacks L3 (lunchbox, energy drink, expired milk, fortune cookie) + bubble wrap, with a pan to fight. Not in god mode: the armor and heals matter.
export default defineSim({
  id: 'snacks-defense',
  notes: 'Defensive items, god mode OFF. Let the milk hit you.',
  god: false,
  cart: [
    { id: Item.pan, at: [0, 0] },
    { id: Item.lunchbox },
    { id: Item.energy },
    { id: Item.expiredmilk },
    { id: Item.fortune },
    { id: Item.bubblewrap },
  ],
  enemies: [{ id: Enemy.milk, count: 4, immortal: false }],
});
