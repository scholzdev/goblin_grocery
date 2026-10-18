import { defineSim } from './_sim';
import { Item } from '../engine/ids';

// Scratch Ticket: one roll on the seeded combat rng at the start of every aisle. The seed is fixed, so F9 repeats the same roll.
export default defineSim({
  id: 'item-scratch-ticket',
  notes: 'Scratch Ticket ★1: at aisle start a 1-in-5 chance of +30 coins, otherwise -4 HP (never below 1). Seed 1, aisle 1: F9 repeats the same roll (a sim boots the arena twice, so the roll can fire twice and cost -8 HP; a real aisle rolls once); change the aisle or seed in the sim file to see the other outcomes.',
  god: false,
  hp: 40,
  waves: true,
  cart: [
    { id: Item.toaster, at: [0, 0] },
    { id: Item.scratchticket, at: [3, 0] },
  ],
});
