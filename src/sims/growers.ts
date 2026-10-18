import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Items that grow: Potted Basil with 100 kills already on it (+8% damage), a Kombucha Scoby that has spent 4 aisles in the cart (poison x1.4).
export default defineSim({
  id: 'growers',
  notes: 'Growers: Potted Basil (100 kills = +8% damage to the Pan) and a Kombucha Scoby that is 4 aisles old (its poison is 40% stronger). Every kill the Pan makes counts on the plant.',
  cart: [
    { id: Item.pan, at: [1, 1] },
    { id: Item.basil, at: [3, 1], kills: 100 },
    { id: Item.scoby, at: [3, 2], age: 4 },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
