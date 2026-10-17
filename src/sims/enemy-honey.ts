import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Enemy: honey. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour. Mortal where the behaviour needs a death.
export default defineSim({
  id: 'enemy-honey',
  notes: 'Honey Jar (35 HP): keeps about 220 px away and heals every other grocery within 160 px for 3% of its max HP each second (a gold tether shows it). The four Soda Six-Packs start in the same bunch as mortal heal targets (honey jars never heal each other). Pop the jars first.',
  cart: [
    { id: Item.pan, tier: 2, at: [1, 1] },
    { id: Item.toaster, tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: Enemy.honey, count: 6, spread: 'cluster', at: [1040, 420] },
    { id: Enemy.soda, count: 4, spread: 'cluster', at: [960, 420], immortal: false },
  ],
});
