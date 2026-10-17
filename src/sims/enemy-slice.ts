import { defineSim } from './_sim';

// Enemy: slice. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-slice',
  notes: 'Melon Slice (5 HP, speed 95): fast and fragile, worth no coins. What a Watermelon leaves behind (see enemy-melon).',
  cart: [
    { id: 'pan', tier: 2, at: [1, 1] },
    { id: 'toaster', tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: 'slice', count: 10, spread: 'cluster' },
  ],
});
