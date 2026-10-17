import { defineSim } from './_sim';

// Enemy: cereal. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour.
export default defineSim({
  id: 'enemy-cereal',
  notes: 'Cereal Box (45 HP): the cardboard front blocks the first 6 toast shots that hit its face, then goes soggy. Pan sweeps, blasts, burn and dashes ignore it.',
  cart: [
    { id: 'pan', tier: 2, at: [1, 1] },
    { id: 'toaster', tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: 'cereal', count: 8, spread: 'cluster' },
  ],
});
