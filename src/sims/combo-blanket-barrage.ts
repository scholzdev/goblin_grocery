import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-blanket-barrage', notes: 'Blanket Barrage: kernels weaken their targets.', cart: [{ id: Item.popcorn, at: [2, 1] }, { id: Item.blanket, at: [0, 1] }], enemies: [{ id: Enemy.milk, count: 8, spread: 'cluster' }] });
