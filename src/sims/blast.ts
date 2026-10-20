import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Blast L3: nail gun + ★2 popper, ★2 double bag and multipack (all Blast): 6 points. The three modules touch the nail gun.
export default defineSim({
  id: 'blast',
  notes: 'Blast L3: popper, double bag and multipack all touch the nail gun. The dummies are mortal so kill effects trigger; the Dummies panel or F9 respawns them.',
  cart: [
    { id: Item.nailgun, at: [1, 1] },
    { id: Item.popper, tier: 2, at: [0, 1] },
    { id: Item.doublebag, tier: 2, at: [1, 0] },
    { id: Item.multipack, at: [3, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 12, spread: 'cluster', immortal: false }],
});
