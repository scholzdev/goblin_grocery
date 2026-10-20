import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

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
