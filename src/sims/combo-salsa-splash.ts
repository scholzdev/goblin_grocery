import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-salsa-splash', notes: 'Salsa Splash: tomato poison splashes nearby groceries.', cart: [{ id: Item.tomato, at: [2, 1] }, { id: Item.fan, at: [1, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
