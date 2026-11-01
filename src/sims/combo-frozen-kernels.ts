import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-frozen-kernels', notes: 'Frozen Kernels: popcorn carries the snow cone chill farther.', cart: [{ id: Item.snowcone, at: [2, 1] }, { id: Item.popcorn, at: [1, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
