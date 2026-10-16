import { defineSim } from './_sim';

// Blast L3: nail gun + popper, double bag and multipack (all Blast). The three modules touch the nail gun.
export default defineSim({
  id: 'blast',
  notes: 'Blast L3: popper, double bag and multipack all touch the nail gun. The dummies are mortal so kill effects trigger; the Dummies panel or F9 respawns them.',
  cart: [
    { id: 'nailgun', at: [1, 1] },
    { id: 'popper', at: [0, 1] },
    { id: 'doublebag', at: [1, 0] },
    { id: 'multipack', at: [3, 1] },
  ],
  enemies: [{ id: 'milk', count: 12, spread: 'cluster', immortal: false }],
});
