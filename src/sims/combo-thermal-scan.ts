import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: thermalScan. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-thermal-scan',
  notes: 'Thermal Scanner: each beam leaves 3 fire pools along its line for 2 s (the Fuel Can makes them burn).',
  cart: [
    { id: Item.laser, at: [2, 1] },
    { id: Item.fuel, at: [1, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
