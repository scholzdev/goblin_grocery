import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Detonate: poisoned + a blast hit. The Moldy Bread poisons through the Pressure Cooker's first pot, the next pot's blast detonates.
export default defineSim({
  id: 'reaction-detonate',
  notes: 'Detonate: a pot of the Pressure Cooker leaves a spore cloud (Moldy Bread) that poisons, the next pot on a poisoned Sour Milk bursts DETONATE! (teal): its poison dps x the seconds it had left within 70 px, the poison gone. Once per second per enemy.',
  cart: [
    { id: Item.cooker, tier: 1, at: [2, 1] },
    { id: Item.moldybread, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
