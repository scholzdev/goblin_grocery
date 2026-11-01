import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-polar-arc', notes: 'Polar Arc: slush puddles shock soaked groceries.', cart: [{ id: Item.snowcone, at: [2, 1] }, { id: Item.battery, at: [2, 0] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
