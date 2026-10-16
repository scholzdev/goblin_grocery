import { defineSim } from './_sim';

// Combo: clearanceSale. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-clearance-sale',
  notes: 'Clearance Sale: the fizz ricochets two more times and each enemy drops a coin the first time a crit lands on it. The coupon gives crit chance. Dummies are mortal.',
  cart: [
    { id: 'fizz', at: [2, 1] },
    { id: 'pricegun', at: [1, 0] },
    { id: 'coupon', at: [3, 0] },
  ],
  enemies: [{ id: 'milk', count: 12, spread: 'cluster', immortal: false }],
});
