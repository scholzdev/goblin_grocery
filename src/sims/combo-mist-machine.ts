import { defineSim } from './_sim';

// Combo: mistMachine. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-mist-machine',
  notes: 'Mist Machine: the spray cone is wider (120 degrees) and reaches farther. The fan bonus does not apply to the spray.',
  cart: [
    { id: 'spray', at: [2, 1] },
    { id: 'fan', at: [1, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
