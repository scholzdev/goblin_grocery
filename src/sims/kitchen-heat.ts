import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'kitchen-heat',
  notes: 'Kitchen L3 + Heat L3. The hot sauce touches the toaster, the pan and the microwave. The dummies are mortal so kill effects trigger; the Dummies panel or F9 respawns them. Starts at 5 HP with god mode off, so the Kitchen kill-heal is visible.',
  cart: [
    { id: Item.toaster, at: [0, 0] },
    { id: Item.pan, at: [0, 1] },
    { id: Item.hotsauce, tier: 3, at: [1, 1] },
    { id: Item.microwave, at: [2, 0] },
  ],
  god: false,
  hp: 5,
  enemies: [{ id: Enemy.milk, count: 12, spread: 'cluster', immortal: false }],
});
