import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// Boss: boss_checkout. A real aisle 8 in its department (waves, director, the boss) with the same strong cart as the 'boss' sim, god mode on.
export default defineSim({
  id: 'boss-checkout',
  notes: 'The Self-Checkout Kiosk (1550 HP), checkout aisle 8. Loop: conveyor, charge, volley (7 receipts in a 70° fan), summon (4 gums and gift cards), charge, conveyor. The conveyor shoves you toward the boss at 170 px/s for 2.4 s: walk against the chevrons. Armor 3: every direct hit loses 3 damage (Shred strips it).',
  waves: true,
  aisle: 8,
  department: 'checkout',
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
