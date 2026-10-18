import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Active items: all four E-key actives in one cart.
export default defineSim({
  id: 'actives',
  notes: 'Press E: Fire Extinguisher (3 blasts, 70° cone at the nearest enemy), Air Horn (1 stun for everyone), Bubble Wrap Pop (1.5 s invulnerable + blast) and Vacuum Full Suck (2 s of triple pull) all fire at once. Charges refill each aisle (restart with F9).',
  cart: [
    { id: Item.vacuum, at: [0, 0] },
    { id: Item.bubblewrap, at: [4, 0] },
    { id: Item.airhorn, at: [4, 1] },
    { id: Item.fireextinguisher, at: [5, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster', at: [800, 480] }],
});
