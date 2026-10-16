import { defineSim } from './_sim';

// Snacks L3 (lunchbox, energy drink, expired milk, fortune cookie) + bubble wrap, with a pan to fight. Not in god mode: the armor and heals matter.
export default defineSim({
  id: 'snacks-defense',
  notes: 'Defensive items, god mode OFF. Let the milk hit you.',
  god: false,
  cart: [
    { id: 'pan', at: [0, 0] },
    { id: 'lunchbox' },
    { id: 'energy' },
    { id: 'expiredmilk' },
    { id: 'fortune' },
    { id: 'bubblewrap' },
  ],
  enemies: [{ id: 'milk', count: 4, immortal: false }],
});
