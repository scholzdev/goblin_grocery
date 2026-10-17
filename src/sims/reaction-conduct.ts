import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Conduct: wet + an electric hit. The Spray Bottle soaks, the Laser's beam is electric.
export default defineSim({
  id: 'reaction-conduct',
  notes: 'Conduct: the Spray Bottle makes a baguette wet, the next Laser beam on it is electric. The beam is x1.2 on the wet baguette, then CONDUCT! jumps along the 3 nearest baguettes (60% of the beam each, teal) and the Wet is gone. Once per second per enemy. A beam that kills conducts too. A packed bunch, so the bolts have somewhere to go.',
  cart: [
    { id: Item.spray, tier: 1, at: [0, 0] },
    { id: Item.laser, tier: 1, at: [2, 1] },
  ],
  enemies: [{ id: Enemy.baguette, count: 10, spread: 'cluster' }],
});
