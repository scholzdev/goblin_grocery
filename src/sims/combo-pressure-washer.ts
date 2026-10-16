import { defineSim } from './_sim';

// Combo: pressureWasher. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-pressure-washer',
  notes: 'Pressure Washer: the spray becomes a narrow, long, strong jet (battery touches the spray bottle).',
  cart: [
    { id: 'spray', at: [2, 1] },
    { id: 'battery', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
