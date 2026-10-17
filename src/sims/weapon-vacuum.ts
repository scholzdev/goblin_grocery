import { defineSim } from './_sim';

// Weapon: vacuum. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-vacuum',
  notes: 'Vacuum ★3: constantly pulls enemies within 150 toward the cart (they stop short of it), and every 0.52 s a pulse hits everything inside for 4. Kill some: coins fly in from 130 px away (+60 pickup radius). The dummies here are mortal (F9 restarts the sim).',
  cart: [{ id: 'vacuum', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 10, spread: 'random', immortal: false }],
});
