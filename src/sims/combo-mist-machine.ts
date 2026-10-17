import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: mistMachine. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-mist-machine',
  notes: 'Mist Machine: the spray cone is wider (120 degrees) and reaches farther. The fan bonus does not apply to the spray.',
  cart: [
    { id: Item.spray, at: [2, 1] },
    { id: Item.fan, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
