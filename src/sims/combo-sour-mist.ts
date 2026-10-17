import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: sourMist. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-sour-mist',
  notes: 'Sour Mist: the spray poisons everything in the cone (4 dps for 3 s). The fan touches the spray, so Mist Machine (wide, long cone) is active too.',
  cart: [
    { id: Item.spray, at: [2, 1] },
    { id: Item.expiredmilk, at: [1, 0] },
    { id: Item.fan, at: [3, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
