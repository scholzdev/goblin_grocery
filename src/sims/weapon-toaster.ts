import { defineSim } from './_sim';

// Weapon: toaster. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-toaster',
  notes: 'Toaster ★3: one toast every 0.8 s for 18 damage, thrown at the nearest enemy within 455. Watch the volley: a single toast, one enemy per toast, the pop sound at normal pitch.',
  cart: [{ id: 'toaster', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 8, spread: 'cluster', at: [940, 480] }],
});
