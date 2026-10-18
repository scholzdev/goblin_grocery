import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Fresh perishables (age 0): the Avocado adds +10% damage to the Toaster, the Fresh Fish +15% crit chance to every weapon.
export default defineSim({
  id: 'perishables-fresh',
  notes: 'Fresh: Avocado (+10% damage to the touching Toaster, ripens +10% per aisle) and Fresh Fish (+15% crit chance for 2 aisles). Compare with perishables-spoiled.',
  cart: [
    { id: Item.toaster, at: [1, 1] },
    { id: Item.avocado, at: [3, 1], age: 0 },
    { id: Item.fish, at: [1, 3], age: 0 },
  ],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
