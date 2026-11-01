import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-chill-kernels', notes: 'Chill Kernels: popcorn hits slow groceries.', cart: [{ id: Item.popcorn, at: [2, 1] }, { id: Item.ice, at: [1, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
