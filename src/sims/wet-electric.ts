import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Wet + electric: a Spray Bottle soaks the crowd, a Blender (an `electric` hit) and a Toaster with the Electric set L3 (Toaster, ★2 Vacuum, ★2 Blender, Battery: 6 points) hit it.
// The toaster's arc is the chain: 3 jumps, 4 when the enemy it starts on is wet.
export default defineSim({
  id: 'wet-electric',
  notes: 'Spray Bottle: every enemy the cone hits is Wet for 3 s (blue droplets on its body). Blender hits are electric: x1.2 on a wet enemy. Electric L3 (Toaster + ★2 Vacuum + ★2 Blender + Battery): a toast arcs to 3 more enemies, 4 when the grocery it hit is wet. Switch the Spray Bottle out (F8) for the dry numbers.',
  god: true,
  cart: [
    { id: Item.spray, tier: 1, at: [0, 0] },
    { id: Item.blender, tier: 2, at: [1, 2] },
    { id: Item.toaster, tier: 1, at: [4, 0] },
    { id: Item.vacuum, tier: 2, at: [4, 2] },
    { id: Item.battery, at: [6, 0] },
  ],
  enemies: [
    { id: Enemy.milk, count: 10, spread: 'cluster' },
  ],
});
