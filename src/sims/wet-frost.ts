import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Wet + frost: Spray Bottle + Mop + Ice Pack are three Frost types (L2: hits on slowed enemies sometimes freeze). The spray and the mop soak the crowd.
export default defineSim({
  id: 'wet-frost',
  notes: 'Spray Bottle and Mop soak enemies for 3 s. Frost slows on a wet enemy get +10 points (Ice Pack 25% + Frost 10 = 35%, 45% on a wet enemy; never past 70%). Frost L2 freeze (10%, 0.5 s on slowed enemies) is 20% on a wet one. Soap puddles and the wet floor slow without the bonus (not frost).',
  god: true,
  cart: [
    { id: Item.spray, tier: 1, at: [0, 0] },
    { id: Item.ice, at: [0, 2] },
    { id: Item.mop, tier: 1, at: [3, 0] },
  ],
  enemies: [
    { id: Enemy.milk, count: 6, spread: 'cluster' },
    { id: Enemy.beans, count: 3, spread: 'cluster' },
  ],
});
