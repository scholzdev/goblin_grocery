import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: fiveAlarm. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-five-alarm',
  notes: 'Five-Alarm Toast: toasts deal x1.8 to burning enemies (the fuel can sets them on fire).',
  cart: [
    { id: Item.toaster, at: [2, 1] },
    { id: Item.hotsauce, at: [2, 0] },
    { id: Item.fuel, at: [1, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
