import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// Boss: boss_frozen. A real aisle 8 in its department (waves, director, the boss) with the same strong cart as the 'boss' sim, god mode on.
export default defineSim({
  id: 'boss-frozen',
  notes: 'The Walk-In Freezer (1700 HP), frozen aisle 8. Loop: Cold Snap, volley (6 bubbles in an 80° fan), charge, summon (3 expired and sour milk), Cold Snap, charge. Cold Snap marks 3 circles (4 below half HP), one on you, and leaves 7 s of slowing slush. Its charge is long (0.9 s).',
  waves: true,
  aisle: 8,
  department: 'frozen',
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
