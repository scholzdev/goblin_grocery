import { defineSim } from './_sim'; import { Enemy, Item } from '../engine/ids';
export default defineSim({ id: 'combo-frost-armor', notes: 'Frost Armor: frozen padding grants extra invulnerability.', cart: [{ id: Item.snowcone, at: [2, 1] }, { id: Item.blanket, at: [0, 1] }], enemies: [{ id: Enemy.spitter, count: 3, still: false }] });
