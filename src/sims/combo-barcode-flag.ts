import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: barcodeFlag. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-barcode-flag',
  notes: 'Sale Scan: the laser beam marks every enemy in its line for the Sale Flag mark time (they take +20% from everything).',
  cart: [
    { id: Item.laser, at: [2, 1] },
    { id: Item.flag, at: [1, 2] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
