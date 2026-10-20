import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Snacks L3 (lunchbox, ★2 energy drink, expired milk, ★2 fortune cookie: 6 points) + bubble wrap, with a pan to fight. Not in god mode: the armor and heals matter.
export default defineSim({
  id: 'snacks-defense',
  notes: 'Defensive items, god mode OFF. Let the milk hit you.',
  god: false,
  cart: [
    { id: Item.pan, at: [0, 0] },
    { id: Item.lunchbox },
    { id: Item.energy, tier: 2 },
    { id: Item.expiredmilk },
    { id: Item.fortune, tier: 2 },
    { id: Item.bubblewrap },
  ],
  enemies: [{ id: Enemy.milk, count: 4, immortal: false }],
});
