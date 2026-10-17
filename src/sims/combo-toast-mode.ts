import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: toastMode. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-toast-mode',
  notes: 'Toast Mode: the toaster fires three flaming toasts per shot (fan and fuel can touching it).',
  cart: [
    { id: Item.toaster, at: [2, 1] },
    { id: Item.fan, at: [1, 0] },
    { id: Item.fuel, at: [4, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
