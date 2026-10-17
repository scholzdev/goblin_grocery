import { defineSim } from './_sim';

// Enemy: spitter. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-spitter',
  notes: 'Detergent Spitter (18 HP): holds about 270 px away and strafes, then every 2.6 s winds up 0.45 s and fires a fan of 3 slow bubbles 22° apart, 5 damage each. Walk through the gaps.',
  cart: [
    { id: 'pan', tier: 2, at: [1, 1] },
    { id: 'toaster', tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: 'spitter', count: 6 },
  ],
});
