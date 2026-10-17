import { defineSim } from './_sim';

// Boss: boss_electronics. A real aisle 8 in its department (waves, director, the boss) with the same strong cart as the 'boss' sim, god mode on.
export default defineSim({
  id: 'boss-electronics',
  notes: 'The Smart-TV Wall (1500 HP), electronics aisle 8. Loop: cable lanes, volley (9 caps in a wide 100° fan), summon (3 spitters and beans), lanes, charge, volley. Lanes are 3 telegraphed strips 170 px apart (5 below half HP), 76 px wide, top to bottom. It is slow (speed 34).',
  waves: true,
  aisle: 8,
  department: 'electronics',
  cart: [
    { id: 'toaster', tier: 3, at: [0, 0] },
    { id: 'hotsauce', tier: 3, at: [0, 1] },
    { id: 'fan', tier: 3, at: [2, 0] },
    { id: 'pan', tier: 3, at: [3, 0] },
    { id: 'fuel', tier: 3, at: [4, 0] },
    { id: 'microwave', tier: 2, at: [4, 1] },
    { id: 'battery', tier: 2, at: [6, 2] },
    { id: 'magnet' },
    { id: 'boot' },
  ],
});
