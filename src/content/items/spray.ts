import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS, WET_STATUS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `cone` (engine/patterns/cone.ts) with the default spray sprite and the default knockback 40. Sour Mist and Tailwind hook `pattern:cone`. `tune.wet` (the spray only, the Leaf Blower has none) soaks every enemy the cone hits for that many seconds, before the hit.
const W = weaponBase({ pattern: 'cone', damage: 3, cooldown: 0.55, range: 170, arcDeg: 70 });

export default defineItem({
  id: Item.spray, kind: 'weapon', sets: [Set.cleaning, Set.frost], shape: '1x2', price: 12, tags: ['melee'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, arcDeg: W.arcDeg, wet: WET_STATUS.duration },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Spray Bottle', blurb: 'Pssht pssht pssht. Hits everything in front.', rules: 'Every {cooldown|s} sprays a {arcDeg|deg} cone ({range} reach) for {damage} damage to every enemy inside (each once per spray) and makes them Wet for {wet|s}.' },
    de: { name: 'Sprühflasche', blurb: 'Pssht pssht pssht. Trifft alles davor.', rules: 'Sprüht alle {cooldown|s} einen {arcDeg|deg}-Kegel ({range} Reichweite) und macht {damage} Schaden an jedem Gegner darin (je einmal pro Sprühstoß) und macht sie {wet|s} lang nass.' },
  },
});
