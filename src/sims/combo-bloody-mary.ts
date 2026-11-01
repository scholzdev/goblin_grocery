import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-bloody-mary', notes: 'Bloody Mary: tomato hits mark groceries.', cart: [{ id: Item.tomato, at: [2, 1] }, { id: Item.hotsauce, at: [1, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
