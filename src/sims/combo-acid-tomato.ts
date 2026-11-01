import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-acid-tomato', notes: 'Acid Tomato: fuel makes tomato hits burn.', cart: [{ id: Item.tomato, at: [2, 1] }, { id: Item.fuel, at: [1, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
