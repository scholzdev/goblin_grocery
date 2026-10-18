import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Ice Sheet: wet + a frost hit that did not freeze. The Snow Cone Machine's puddle soaks, the Ice Pack makes the Toaster's toasts frost hits.
export default defineSim({
  id: 'reaction-ice-sheet',
  notes: 'Ice Sheet: the Snow Cone Machine puddle soaks a baguette and a toast slowed by the Ice Pack sends it down the ice: ICE SHEET! (teal), it slides away from the cart with no steering for 1.5 s, 12 slam damage when it hits a wall, a prop or another baguette. The Wet is gone. Once per second per enemy; a freeze comes first.',
  cart: [
    { id: Item.snowcone, tier: 1, at: [2, 1] },
    { id: Item.toaster, tier: 1, at: [0, 0] },
    { id: Item.ice, at: [0, 1] },
  ],
  enemies: [{ id: Enemy.baguette, count: 8, spread: 'cluster' }],
});
