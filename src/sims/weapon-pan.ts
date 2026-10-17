import { defineSim } from './_sim';

// Weapon: pan. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-pan',
  notes: 'Frying Pan ★3: a 150° sweep every 0.92 s at the nearest enemy, 150 reach, each enemy once per swing with a push of 150. The ring puts enemies on all sides: only the half in the arc gets hit.',
  cart: [{ id: 'pan', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 12, spread: 'ring' }],
});
