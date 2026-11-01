import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-buttered-popcorn', notes: 'Buttered Popcorn: the snack machine fires faster.', cart: [{ id: Item.popcorn, at: [2, 1] }, { id: Item.lunchbox, at: [2, 0] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
