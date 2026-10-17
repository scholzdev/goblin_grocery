import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Wet + heat: the Spray Bottle soaks, a Toaster with a Fuel Can burns. A burn on a wet enemy lasts half as long and dries it (steam).
export default defineSim({
  id: 'wet-steam',
  notes: 'Spray Bottle: Wet for 3 s. A Toaster with a Fuel Can burns every toast: on a wet enemy the burn lasts half as long and the Wet is gone (steam), so the next spray soaks it again and the next toast halves the burn again. Dry enemies get the full burn. Burn ticks already running are never touched.',
  god: true,
  cart: [
    { id: Item.spray, tier: 1, at: [0, 0] },
    { id: Item.toaster, tier: 1, at: [3, 1] },
    { id: Item.fuel, at: [5, 1] },
  ],
  enemies: [
    { id: Enemy.milk, count: 6, spread: 'cluster' },
    { id: Enemy.baguette, count: 2 },
  ],
});
