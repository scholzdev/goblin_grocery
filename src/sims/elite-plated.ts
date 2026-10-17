import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// The plated affix: +3 armor on top of the type's own, through the same armor rule as Canned Beans. A plain Beans group stands next to it for the comparison.
export default defineSim({
  id: 'elite-plated',
  notes: 'Toaster ★1 (9 per toast). Plated milk: armor 3, so 6 per toast. Plated beans: armor 3 + 3, so 3 per toast (the 30% floor). Plain beans: 6. Elites have 3.5x HP. F8, then add a Can Opener next to the toaster to strip the plating.',
  cart: [{ id: Item.toaster, tier: 1, at: [2, 1] }],
  enemies: [
    { id: Enemy.milk, count: 2, affix: 'plated', spread: 'cluster' },
    { id: Enemy.beans, count: 2, affix: 'plated', spread: 'cluster' },
    { id: Enemy.beans, count: 2, spread: 'cluster' },
  ],
});
