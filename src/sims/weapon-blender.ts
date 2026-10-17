import { defineSim } from './_sim';

// Weapon: blender. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-blender',
  notes: 'Blender ★3: shreds every enemy within 85 (plus their radius) for 4 every 0.24 s with a tiny push, and keeps a blade ring spinning around the cart. Let the walkers come to you.',
  cart: [{ id: 'blender', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 10, spread: 'random' }],
});
