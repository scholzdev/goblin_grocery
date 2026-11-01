import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-tomato-helmet', notes: 'Tomato Helmet: the rotten weapon grants defense.', cart: [{ id: Item.tomato, at: [2, 1] }, { id: Item.helmet, at: [0, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
