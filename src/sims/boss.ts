import { defineSim } from './_sim';

// The boss aisle (8) with a strong heat/electric cart.
export default defineSim({
  id: 'boss',
  notes: 'Real boss aisle, seed 1, strong cart.',
  waves: true,
  aisle: 8,
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
