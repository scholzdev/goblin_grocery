import { defineSim } from './_sim';

// Combo: smashBank. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-smash-bank',
  notes: 'Smash the Bank: every enemy the pan hits has a 15% chance to drop a coin.',
  cart: [
    { id: 'pan', at: [2, 1] },
    { id: 'piggy', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
