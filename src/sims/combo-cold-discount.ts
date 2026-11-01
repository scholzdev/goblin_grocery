import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-cold-discount', notes: 'Cold Discount: snow cone puddles reach farther.', cart: [{ id: Item.snowcone, at: [2, 1] }, { id: Item.coupon, at: [2, 0] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
