import { defineSim } from './_sim';

// Electric L1 (two electrical items): the baseline for electric-l3.
export default defineSim({
  id: 'electric-l1',
  notes: 'Electric L1: nail gun + vacuum.',
  cart: [
    { id: 'nailgun', at: [0, 0] },
    { id: 'vacuum', at: [0, 1] },
  ],
  enemies: [{ id: 'cereal', count: 8, spread: 'cluster' }],
});
