import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-thick-smoothie',
  notes: 'Thick Smoothie: Blender hits slow groceries in the blade ring.',
  cart: [{ id: Item.blender, at: [2, 1] }, { id: Item.blanket, at: [0, 1] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
