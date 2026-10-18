import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Combo: liveWire. The parts are placed explicitly so every adjacency the recipe needs is met.
export default defineSim({
  id: 'combo-live-wire',
  notes: 'Live Wire: every second the mop puddles zap up to 3 Wet enemies that were just inside for the puddle tick damage, without using up Wet.',
  cart: [
    { id: Item.mop, at: [2, 1] },
    { id: Item.battery, at: [1, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster' }],
});
