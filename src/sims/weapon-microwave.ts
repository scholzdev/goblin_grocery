import { defineSim } from './_sim';

// Weapon: microwave. The weapon alone at ★3 in the cart, with enemies that show off its pattern.
export default defineSim({
  id: 'weapon-microwave',
  notes: 'Microwave ★3: every 1.92 s a zap at the toughest enemy within 380 (an Elite first, then most HP) for 48, splashing everything within 70 of it. Watch it ignore the milk bunch and pick the elite and the cereal.',
  cart: [{ id: 'microwave', tier: 3, at: [2, 1] }],
  enemies: [{ id: 'milk', count: 6, spread: 'cluster', at: [900, 400] }, { id: 'cereal', count: 3, spread: 'cluster', at: [900, 400] }, { id: 'melon', affix: 'elite', at: [420, 560] }],
});
