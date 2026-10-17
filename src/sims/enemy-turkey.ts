import { defineSim } from './_sim';

// Enemy: turkey. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-turkey',
  notes: 'Frozen Turkey (150 HP, speed 38): the slowest and hardest bruiser. 92% knockback resist, 9 damage on contact.',
  cart: [
    { id: 'pan', tier: 2, at: [1, 1] },
    { id: 'toaster', tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: 'turkey', count: 6, spread: 'cluster' },
  ],
});
