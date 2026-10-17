import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// The boss aisle (8) with a strong heat/electric cart.
export default defineSim({
  id: 'boss',
  notes: 'Real boss aisle, seed 1, strong cart.',
  waves: true,
  aisle: 8,
  cart: [
    { id: Item.toaster, tier: 3, at: [0, 0] },
    { id: Item.hotsauce, tier: 3, at: [0, 1] },
    { id: Item.fan, tier: 3, at: [2, 0] },
    { id: Item.pan, tier: 3, at: [3, 0] },
    { id: Item.fuel, tier: 3, at: [4, 0] },
    { id: Item.microwave, tier: 2, at: [4, 1] },
    { id: Item.battery, tier: 2, at: [6, 2] },
    { id: Item.magnet },
    { id: Item.boot },
  ],
});
