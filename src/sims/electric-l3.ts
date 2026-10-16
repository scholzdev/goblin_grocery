import { defineSim } from './_sim';

// Electric L3 (four electrical items). The battery touches the nail gun and the laser.
export default defineSim({
  id: 'electric-l3',
  notes: 'Electric L3: nail gun, vacuum, battery, laser.',
  cart: [
    { id: 'nailgun', at: [0, 0] },
    { id: 'battery', at: [2, 0] },
    { id: 'laser', at: [2, 0] },
    { id: 'vacuum', at: [0, 1], rot: 1 },
  ],
  enemies: [{ id: 'cereal', count: 8, spread: 'cluster' }],
});
