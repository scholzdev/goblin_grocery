import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Cleaning L2: Spray Bottle + Leaf Blower + a ★2 Desk Fan are 4 cleaning points (the fan touches only the leaf blower, so the spray stays bare). Every direct hit of a cleaning
// weapon weakens: the spray cone and the leaf blower's push alike (quiet cone hits count). With this short an interval the status simply stays on whatever they keep touching.
export default defineSim({
  id: 'weaken-cleaning',
  notes: 'Cleaning L2 (Spray Bottle + Leaf Blower + ★2 Desk Fan): every cleaning hit weakens the grocery by 20% for 2 s, L3 is the same (a lavender down-arrow right of its health bar). The spray cone is quiet and still counts. It fires every 0.55 s (the leaf blower every 0.9 s), well inside the 2 s, so whatever the cone keeps touching simply stays weakened. Contact: Sour Milk 4 becomes 3, Baguette 5 becomes 4. God mode is off and the groceries are immortal: watch your HP bar.',
  god: false,
  cart: [
    { id: Item.spray, tier: 1, at: [0, 0] },
    { id: Item.leafblower, tier: 1, at: [2, 0] },
    { id: Item.fan, tier: 2, at: [4, 0] },
  ],
  enemies: [
    { id: Enemy.milk, count: 3 },
    { id: Enemy.baguette, count: 2 },
  ],
});
