import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-prep-line',
  notes: 'Prep Line: the Lunchbox keeps the Blender spinning faster.',
  cart: [{ id: Item.blender, at: [2, 1] }, { id: Item.lunchbox, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
