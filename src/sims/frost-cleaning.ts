import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Frost L3 (mop, spray, ice, fizz) + Cleaning L3 (mop, spray, fan, leaf blower). Ice and fan sit between the weapons.
export default defineSim({
  id: 'frost-cleaning',
  notes: 'Frost L3 + Cleaning L3. Ice touches mop and spray, the fan touches spray, fizz and leaf blower.',
  cart: [
    { id: Item.mop, at: [0, 0] },
    { id: Item.ice, at: [1, 0] },
    { id: Item.spray, at: [2, 0] },
    { id: Item.fan, at: [3, 0] },
    { id: Item.fizz, at: [4, 0] },
    { id: Item.leafblower, at: [4, 1] },
  ],
  enemies: [{ id: Enemy.cereal, count: 6 }],
});
