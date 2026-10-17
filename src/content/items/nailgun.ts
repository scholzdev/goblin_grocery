import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `burst` (engine/patterns/burst.ts): `count` nails, `burstInterval` apart, each with a little spread (one rng draw per nail). Nailstorm and Ray Gun
// reshape the nails through `pattern:fire` / `pattern:shotHit` / `pattern:shotMove`.
const W = weaponBase({ pattern: 'burst', damage: 3, cooldown: 1.1, range: 480, projectileSpeed: 760, count: 3, burstInterval: 0.08 });

export default defineItem({
  id: Item.nailgun, kind: 'weapon', sets: [Set.tools, Set.blast], shape: '2x1', price: 16, tags: ['ranged'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Nail Gun', blurb: 'Rat-a-tat three-nail bursts.', rules: 'Fires a three-nail burst every {cooldown|s}. {damage} damage per nail. {range} range.' },
    de: { name: 'Nagelpistole', blurb: 'Ratatatat, Dreier-Nagelsalven.', rules: 'Feuert alle {cooldown|s} eine Dreier-Nagelsalve. {damage} Schaden pro Nagel. {range} Reichweite.' },
  },
});
