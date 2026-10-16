import { defineSim } from './_sim';

// Combo: tvDinner. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-tv-dinner',
  notes: 'TV Dinner: the microwave zap chains one more link; chain links deal 60%.',
  cart: [
    { id: 'microwave', at: [2, 1] },
    { id: 'lunchbox', at: [2, 0] },
    { id: 'battery', at: [4, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
