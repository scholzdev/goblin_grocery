import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Decaf ★3 next to a ★1 toaster (9 per toast), against groceries that hurt you: Sour Milk and a Baguette on contact, a Baguette's swipe, a Spitter's bubbles.
// God mode is OFF so the hits land on your HP bar; the groceries are immortal, so they keep coming (F9 restarts).
export default defineSim({
  id: 'weaken-decaf',
  notes: 'Toaster ★1 + Decaf ★3: every toast weakens the grocery it hits by 25% for 3 s (a lavender down-arrow right of its health bar). Contact: Sour Milk 4 becomes 3, Baguette 5 becomes 4. A Baguette swipe: 7 becomes 5. A Spitter bubble: 5 becomes 4, fixed the moment it is fired (a bubble shot before the toast landed still hurts 5). Damage is rounded to whole points. For the "without" run press F8, take the Decaf out of the cart and fight the same crowd (or use F9 for a fresh start).',
  god: false,
  cart: [
    { id: Item.toaster, tier: 1, at: [2, 1] },
    { id: Item.decaf, tier: 3, at: [1, 1] },
  ],
  enemies: [
    { id: Enemy.milk, count: 3 },
    { id: Enemy.baguette, count: 1 },
    { id: Enemy.spitter, count: 1 },
  ],
});
