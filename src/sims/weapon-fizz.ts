import { defineSim } from './_sim';

// Weapon: fizz. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-fizz',
  notes: 'Fizz Cannon ★3: a bottle cap for 12 every 0.8 s that bounces on to up to 2 more enemies within 230 (never the same one twice). Three bunches: watch it hop between them only when they are close enough.',
  cart: [{ id: 'fizz', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 4, spread: 'cluster', at: [840, 300] }, { id: 'milk', count: 4, spread: 'cluster', at: [940, 470] }, { id: 'milk', count: 4, spread: 'cluster', at: [840, 640] }],
});
