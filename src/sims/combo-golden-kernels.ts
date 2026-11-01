import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-golden-kernels', notes: 'Golden Kernels: lucky popcorn gains crit chance.', cart: [{ id: Item.popcorn, at: [2, 1] }, { id: Item.fortune, at: [2, 0] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
