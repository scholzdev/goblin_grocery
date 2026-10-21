import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: pan. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-pan',
  notes: 'Frying Pan ★3: a sweep all the way around the cart every 0.92 s, 150 reach, each enemy once per swing with a push of 150. The ring puts enemies on all sides: at ★3 every one of them gets hit (below ★3 only the half in the 150° arc).',
  cart: [{ id: Item.pan, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 12, spread: 'ring' }],
});
