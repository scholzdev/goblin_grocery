import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Spoiled perishables: a brown Avocado (age 3: -20% damage to the Toaster) and a stinking Fish (age 2: poison aura around the cart, +20% shop prices).
export default defineSim({
  id: 'perishables-spoiled',
  notes: 'Spoiled: the Avocado is brown (-20% damage to the touching Toaster, sells for 1) and the Fresh Fish stinks (green poison aura around the goblin, +20% shop prices, no crit).',
  cart: [
    { id: Item.toaster, at: [1, 1] },
    { id: Item.avocado, at: [3, 1], age: 3 },
    { id: Item.fish, at: [1, 3], age: 2 },
  ],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
