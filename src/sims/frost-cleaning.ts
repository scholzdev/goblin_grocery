import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Frost L3 (★2 mop, ★2 spray, ice, fizz) + Cleaning L3 (★2 mop, ★2 spray, fan, leaf blower): 6 points each. Ice and fan sit between the weapons.
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
