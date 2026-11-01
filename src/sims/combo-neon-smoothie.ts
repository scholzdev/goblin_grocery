import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'combo-neon-smoothie',
  notes: 'Neon Smoothie: Battery-powered blender blades reach farther.',
  cart: [{ id: Item.blender, at: [2, 1] }, { id: Item.battery, at: [2, 0] }],
  enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }],
});
