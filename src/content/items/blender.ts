import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set, Tag } from '../../engine/ids';

// Pattern `aura` (engine/patterns/aura.ts): everything within `range` takes a tick of damage and a small push out; the blade ring spins while fighting. Smoothie Shield hooks `pattern:aura`,
// Brain Freeze's pale, slower blades are its `pattern:look`.
const W = weaponBase({ pattern: 'aura', damage: 2, cooldown: 0.3, range: 85 });

export default defineItem({
  id: Item.blender, kind: 'weapon', sets: [Set.kitchen], shape: '1x2', price: 15, tags: ['melee', 'area'], electrical: true, elements: [Tag.electric],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, pullIn: 20 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Blender', blurb: 'Whirring blades around the cart.', rules: 'Shreds every enemy within {range} for {damage} damage every {cooldown|s} (each enemy once per tick). Electrical.', star3: '★3: The blades pull enemies in instead of pushing them away.' },
    de: { name: 'Mixer', blurb: 'Surrende Klingen rund um den Wagen.', rules: 'Schreddert alle {cooldown|s} jeden Gegner im Umkreis von {range} für {damage} Schaden (jeden Gegner einmal pro Tick). Elektrisch.', star3: '★3: Die Klingen ziehen Gegner heran, statt sie wegzustoßen.' },
  },
});
