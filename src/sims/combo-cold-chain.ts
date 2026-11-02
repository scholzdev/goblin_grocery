import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: coldChain. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-cold-chain',
  notes: 'Cold Chain: the 3rd beam in a row at the same enemy freezes it.',
  cart: [
    { id: Item.laser, at: [2, 1] },
    { id: Item.ice, at: [1, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
