import { defineSim } from './_sim';

// Element soft counters, electric: the Self-Checkout Laser (checkout + electrical, so electric only) against three groups in a row on the right, so one beam crosses all of them.
export default defineSim({
  id: 'affinity-electric',
  notes: 'Self-Checkout Laser (electric): a beam hits every enemy on its line for 20. Soda Six-Pack and Canned Beans are weak to electric: 26 before armor (the beans soak part of it). Sour Milk has no affinity: 20. The beam picks the line with the most enemies, here they all stand on one line, so a single beam shows the three numbers side by side.',
  cart: [
    { id: 'laser', at: [2, 1] },
  ],
  enemies: [
    { id: 'soda', count: 3, still: true, spread: 'cluster', at: [760, 500] },
    { id: 'beans', count: 3, still: true, spread: 'cluster', at: [900, 500] },
    { id: 'milk', count: 3, still: true, spread: 'cluster', at: [1040, 500] },
  ],
});
