import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';

// Pattern `zap` (engine/patterns/zap.ts): the toughest enemy in `range`, `aoe` splash, then `chain` more links. TV Dinner, Sparks Fly and Reheat hook `pattern:zap`.
const W = weaponBase({ pattern: 'zap', damage: 24, cooldown: 2.4, range: 380, aoe: 70 });

export default defineItem({
  id: 'microwave', kind: 'weapon', sets: ['kitchen', 'heat'], shape: cells('.##', '##.'), price: 20, tags: ['area'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, aoe: W.aoe },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Microwave', blurb: 'Ding! Nukes a grocery from across the aisle.', rules: 'Every {cooldown|s} zaps the toughest enemy within {range} (Elites first, then most HP) for {damage} damage, splashing everything within {aoe}. Electrical.' },
    de: { name: 'Mikrowelle', blurb: 'Kling! Beamt einen Gegner quer durch den Gang.', rules: 'Zappt alle {cooldown|s} den zähsten Gegner im Umkreis von {range} (zuerst Elite, dann meiste LP) für {damage} Schaden, mit Flächenschaden im Umkreis von {aoe}. Elektrisch.' },
  },
});
