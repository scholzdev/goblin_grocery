import { defineSim } from './_sim';

// A real aisle 3 (main department) with a decent mid-game cart, to reproduce the suspected wave-3 stall. Fixed seed, aisle event rolled normally.
export default defineSim({
  id: 'wave3',
  notes: 'Real aisle 3, seed 1. Watch the clock and the spawns: does the wave end?',
  waves: true,
  aisle: 3,
  department: 'main',
  event: 'random',
  cart: [
    { id: 'toaster', tier: 2, at: [0, 0] },
    { id: 'fan', at: [2, 0] },
    { id: 'hotsauce', at: [0, 1] },
    { id: 'pan', tier: 2, at: [3, 0] },
    { id: 'fuel', at: [4, 0] },
    { id: 'nailgun', at: [0, 2] },
    { id: 'battery', at: [2, 2] },
    { id: 'boot' },
    { id: 'bell' },
  ],
});
