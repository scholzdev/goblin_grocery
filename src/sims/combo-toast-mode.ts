import { defineSim } from './_sim';

// Combo: toastMode. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-toast-mode',
  notes: 'Toast Mode: the toaster fires three flaming toasts per shot (fan and fuel can touching it).',
  cart: [
    { id: 'toaster', at: [2, 1] },
    { id: 'fan', at: [1, 0] },
    { id: 'fuel', at: [4, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
