import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Weapon: microwave. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-microwave',
  notes: 'Microwave ★3: every 1.92 s a zap at the toughest enemy within 380 (an Elite first, then most HP) for 52.8 (Kitchen L1 from its own 3 set points), splashing everything within 70 of it. Watch it ignore the milk bunch and pick the elite and the cereal. Knocking out the zapped enemy charges the next zap in half the time (these dummies never die, so that does not show here).',
  cart: [{ id: Item.microwave, tier: 3, at: [2, 1] }],
  enemies: [{ id: Enemy.milk, count: 6, spread: 'cluster', at: [900, 400] }, { id: Enemy.cereal, count: 3, spread: 'cluster', at: [900, 400] }, { id: Enemy.melon, affix: 'elite', at: [420, 560] }],
});
