import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// Boss: boss. A real aisle 8 in its department (waves, director, the boss) with the same strong cart as the 'boss' sim, god mode on.
export default defineSim({
  id: 'boss-main',
  notes: 'The Store Manager (1500 HP), main aisle, real boss aisle 8 with its waves and director. Loop: volley (7 receipts in a 70° fan), charge, summon (4 milk and banana), charge, volley, summon. Enrages after 60 s, chains a volley out of a charge below half HP.',
  waves: true,
  aisle: 8,
  department: 'main',
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
