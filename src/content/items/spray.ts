import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `cone` (engine/patterns/cone.ts) with the default spray sprite and the default knockback 40. Sour Mist and Tailwind hook `pattern:cone`.
const W = weaponBase({ pattern: 'cone', damage: 3, cooldown: 0.55, range: 170, arcDeg: 70 });

export default defineItem({
  id: Item.spray, kind: 'weapon', sets: [Set.cleaning, Set.frost], shape: '1x2', price: 12, tags: ['melee'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, arcDeg: W.arcDeg },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Spray Bottle', blurb: 'Pssht pssht pssht. Hits everything in front.', rules: 'Every {cooldown|s} sprays a {arcDeg|deg} cone ({range} reach) for {damage} damage to every enemy inside (each once per spray).' },
    de: { name: 'Sprühflasche', blurb: 'Pssht pssht pssht. Trifft alles davor.', rules: 'Sprüht alle {cooldown|s} einen {arcDeg|deg}-Kegel ({range} Reichweite) und macht {damage} Schaden an jedem Gegner darin (je einmal pro Sprühstoß).' },
  },
});
