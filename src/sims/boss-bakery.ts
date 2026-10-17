import { defineSim } from './_sim';

// Boss: boss_bakery. A real aisle 8 in its department (waves, director, the boss) with the same strong cart as the 'boss' sim, god mode on.
export default defineSim({
  id: 'boss-bakery',
  notes: 'The Industrial Oven (1450 HP), bakery aisle 8. Loop: volley (5 toast in a tight 50° fan), ring of fire (14 shots, 18 below half HP), summon (4 baguettes and bananas), charge, ring, volley.',
  waves: true,
  aisle: 8,
  department: 'bakery',
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
