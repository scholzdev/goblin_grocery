import { defineSim } from './_sim';

// Weapon: spray. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-spray',
  notes: 'Spray Bottle ★3: every 0.44 s a 70° cone (170 reach) for 6 on every enemy inside, a light push of 40. Short range: the bunch starts close in front of the cart.',
  cart: [{ id: 'spray', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 8, spread: 'cluster', at: [820, 480] }],
});
