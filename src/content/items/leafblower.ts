import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `cone` (engine/patterns/cone.ts) with the gust sprite (`weapon.fx`), a heavy push (`weapon.knockback`) and slam damage for groceries blown into a wall
// (`tune.blow`, ★1 value: the pattern scales it by the weapon's damage tier). From ★3 the slam also stuns for `tune.slamStun` s.
const W = weaponBase({ pattern: 'cone', damage: 3, cooldown: 0.9, range: 220, arcDeg: 50, knockback: 300, fx: 'fx_gust' });

export default defineItem({
  id: Item.leafblower, kind: 'weapon', sets: [Set.cleaning], shape: '2x1', price: 14, tags: ['area'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, arcDeg: W.arcDeg, blow: 8, slamStun: 0.5 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Leaf Blower', blurb: 'Huff and puff. Slams groceries into things.', rules: 'Every {cooldown|s} blasts a {arcDeg|deg} cone ({range} reach) for {damage} damage and a heavy push. Blown groceries that hit a wall or prop take {blow} slam damage (scales with level).', star3: '★3: Slammed groceries are also stunned for {slamStun|s}.' },
    de: { name: 'Laubbläser', blurb: 'Puff puff. Schleudert Gegner gegen Sachen.', rules: 'Bläst alle {cooldown|s} einen {arcDeg|deg}-Kegel ({range} Reichweite) für {damage} Schaden und einen kräftigen Stoß. Weggeblasene Gegner, die gegen eine Wand oder Deko prallen, erleiden {blow} Aufprallschaden (skaliert mit der Stufe).', star3: '★3: Aufgeprallte Gegner sind außerdem {slamStun|s} lang betäubt.' },
  },
});
