import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: potSlam. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-pot-slam',
  notes: 'Pot Slam: every dash ends in a pressure cooker blast where you land (Space).',
  cart: [
    { id: Item.cooker, at: [2, 1] },
    { id: Item.bumper, at: [2, 0] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
