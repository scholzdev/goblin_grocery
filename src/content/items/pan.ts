import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `sweep` (engine/patterns/sweep.ts): a 150° arc toward the nearest enemy, `range` reach. Sweep
// combos (Chicken Dinner, Sizzling Skillet, Smash the Bank, Express Checkout) hook `pattern:sweep`.
const W = weaponBase({ pattern: 'sweep', damage: 9, cooldown: 1.15, range: 150, arcDeg: 150 });

export default defineItem({
  id: Item.pan, kind: 'weapon', sets: [Set.kitchen, Set.heat], shape: '1x3', price: 10, tags: ['melee'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, fullArc: 360 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Frying Pan', blurb: 'Big clangy sweep around the cart.', rules: 'Sweeps toward nearby enemies for {damage} damage every {cooldown|s}. {range} reach. Hits each enemy once per swing.', star3: '★3: Sweeps the full {fullArc|deg} around the cart.' },
    de: { name: 'Bratpfanne', blurb: 'Großer, scheppernder Schwung um den Wagen.', rules: 'Schwingt alle {cooldown|s} auf Gegner in der Nähe für {damage} Schaden. {range} Reichweite. Trifft jeden Gegner einmal pro Schwung.', star3: '★3: Schwingt die vollen {fullArc|deg} rund um den Wagen.' },
  },
});
