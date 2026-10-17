import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// A real aisle 3 (main department) with a decent mid-game cart, to reproduce the suspected wave-3 stall. Fixed seed, aisle event rolled normally.
export default defineSim({
  id: 'wave3',
  notes: 'Real aisle 3, seed 1. Watch the clock and the spawns: does the wave end?',
  waves: true,
  aisle: 3,
  department: 'main',
  event: 'random',
  cart: [
    { id: Item.toaster, tier: 2, at: [0, 0] },
    { id: Item.fan, at: [2, 0] },
    { id: Item.hotsauce, at: [0, 1] },
    { id: Item.pan, tier: 2, at: [3, 0] },
    { id: Item.fuel, at: [4, 0] },
    { id: Item.nailgun, at: [0, 2] },
    { id: Item.battery, at: [2, 2] },
    { id: Item.boot },
    { id: Item.bell },
  ],
});
