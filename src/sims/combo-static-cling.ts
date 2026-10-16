import { defineSim } from './_sim';

// Combo: staticCling. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-static-cling',
  notes: 'Static Cling: each vacuum pulse zaps 3 random enemies inside it for 150% damage.',
  cart: [
    { id: 'vacuum', at: [2, 1] },
    { id: 'battery', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
