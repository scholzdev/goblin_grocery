import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: pressureWasher. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-pressure-washer',
  notes: 'Pressure Washer: the spray becomes a narrow, long, strong jet (battery touches the spray bottle).',
  cart: [
    { id: Item.spray, at: [2, 1] },
    { id: Item.battery, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
