import { defineSim } from './_sim';

// Combo: sugarRush. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-sugar-rush',
  notes: 'Sugar Rush (cart combo, no weapon): every dash (Space) adds a stack of +8% speed for 3 s, up to 5. Watch the SUGAR text over the goblin.',
  cart: [
    { id: 'energy', at: [2, 1] },
    { id: 'boot', at: [2, 0] },
  ],
  enemies: [{ id: 'milk', count: 10, spread: 'cluster' }],
});
