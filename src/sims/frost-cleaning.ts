import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'frost-cleaning',
  notes: 'Frost L3 + Cleaning L3. Ice touches mop and spray, the fan touches spray, fizz and leaf blower.',
  cart: [
    { id: Item.mop, tier: 2, at: [0, 0] },
    { id: Item.ice, at: [1, 0] },
    { id: Item.spray, tier: 2, at: [2, 0] },
    { id: Item.fan, at: [3, 0] },
    { id: Item.fizz, at: [4, 0] },
    { id: Item.leafblower, at: [4, 1] },
  ],
  enemies: [{ id: Enemy.cereal, count: 6 }],
});
