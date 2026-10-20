import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `mortar` (engine/patterns/mortar.ts): a pot lobbed at the densest cluster in `range`, exploding for `aoe`; from ★3 (`secondPot`) a smaller pot
// goes to the densest cluster outside that blast. Pressure Point and Shrapnel hook `pattern:explode`; Pot Slam calls the same explosion from a dash.
const W = weaponBase({ pattern: 'mortar', damage: 16, cooldown: 2.6, range: 420, aoe: 90, projectileSpeed: 380 });

export default defineItem({
  id: Item.cooker, kind: 'weapon', sets: [Set.kitchen, Set.heat], shape: cells('##.', '.##'), price: 18, tags: ['area'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, aoe: W.aoe, secondPot: [0, 0, 1], secondPotScale: 0.5 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Pressure Cooker', blurb: 'Lobs a whistling pot. KABOOM.', rules: 'Every {cooldown|s} lobs a pot at the densest group within {range}. It explodes for {damage} damage to everything within {aoe}, with knockback.', star3: '★3: Also lobs a smaller pot ({secondPotScale|pct} damage and radius) at the densest group outside that blast.' },
    de: { name: 'Schnellkochtopf', blurb: 'Schleudert einen pfeifenden Topf. KABUMM.', rules: 'Schleudert alle {cooldown|s} einen Topf auf die dichteste Gruppe im Umkreis von {range}. Er explodiert und macht {damage} Schaden an allem im Umkreis von {aoe}, mit Rückstoß.', star3: '★3: Schleudert zusätzlich einen kleineren Topf ({secondPotScale|pct} Schaden und Radius) auf die dichteste Gruppe außerhalb dieser Explosion.' },
  },
});
