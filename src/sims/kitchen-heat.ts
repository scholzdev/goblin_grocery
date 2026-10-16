import { defineSim } from './_sim';

// Kitchen L3 + Heat L3: toaster, pan, hot sauce and microwave all count for both sets.
export default defineSim({
  id: 'kitchen-heat',
  notes: 'Kitchen L3 + Heat L3. The hot sauce touches the toaster, the pan and the microwave.',
  cart: [
    { id: 'toaster', at: [0, 0] },
    { id: 'pan', at: [0, 1] },
    { id: 'hotsauce', at: [1, 1] },
    { id: 'microwave', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 6, spread: 'cluster' }],
});
