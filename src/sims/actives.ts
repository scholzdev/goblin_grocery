import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Active items: four actives in one cart: reading order gives the first three a key (Q / E / F), the 4th has no slot.
export default defineSim({
  id: 'actives',
  notes: 'Slots follow the cart reading order: Vacuum Full Suck (Q), Bubble Wrap Pop (E), Air Horn (F, 1 stun for everyone); the Fire Extinguisher (3 blasts, 70° cone) comes 4th and has no slot (shop badge "No slot"). Charges refill each aisle (restart with F9).',
  cart: [
    { id: Item.vacuum, at: [0, 0] },
    { id: Item.bubblewrap, at: [4, 0] },
    { id: Item.airhorn, at: [4, 1] },
    { id: Item.fireextinguisher, at: [5, 1] },
  ],
  enemies: [{ id: Enemy.milk, count: 10, spread: 'cluster', at: [800, 480] }],
});
