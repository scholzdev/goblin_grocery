import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-tomato-toll', notes: 'Tomato Toll: tomato kills pull loose coins home.', cart: [{ id: Item.tomato, at: [2, 1] }, { id: Item.bell, at: [1, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
