import { defineSim } from './_sim';

// Combo: priceCheck. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-price-check',
  notes: 'Price Check: the laser marks everything in the beam for 3 s; marked enemies take x1.2 from every source.',
  cart: [
    { id: 'laser', at: [2, 1] },
    { id: 'pricegun', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
