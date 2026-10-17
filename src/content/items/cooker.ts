import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `mortar` (engine/patterns/mortar.ts): a pot lobbed at the densest cluster in `range`, exploding for `aoe`. Pressure Point and Shrapnel hook
// `pattern:explode`; Pot Slam calls the same explosion from a dash.
const W = weaponBase({ pattern: 'mortar', damage: 16, cooldown: 2.6, range: 420, aoe: 90, projectileSpeed: 380 });

export default defineItem({
  id: Item.cooker, kind: 'weapon', sets: [Set.kitchen, Set.heat], shape: cells('##.', '.##'), price: 18, tags: ['area'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, aoe: W.aoe },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Pressure Cooker', blurb: 'Lobs a whistling pot. KABOOM.', rules: 'Every {cooldown|s} lobs a pot at the densest group within {range}. It explodes for {damage} damage to everything within {aoe}, with knockback.' },
    de: { name: 'Schnellkochtopf', blurb: 'Schleudert einen pfeifenden Topf. KABUMM.', rules: 'Schleudert alle {cooldown|s} einen Topf auf die dichteste Gruppe im Umkreis von {range}. Er explodiert und macht {damage} Schaden an allem im Umkreis von {aoe}, mit Rückstoß.' },
  },
});
