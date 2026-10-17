import { defineSim } from './_sim';

// Enemy: milk. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-milk',
  notes: 'Sour Milk (14 HP, speed 72): walks straight at you and does nothing else. The baseline to compare the others with. Eight in a bunch, god mode on, so they pile onto the cart.',
  cart: [
    { id: 'pan', tier: 2, at: [1, 1] },
    { id: 'toaster', tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: 'milk', count: 8, spread: 'cluster' },
  ],
});
