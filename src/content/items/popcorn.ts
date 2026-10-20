import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `popcorn` (engine/patterns/popcorn.ts): `count` kernels per volley, each at a random enemy in range (one rng draw per kernel). From ★3 (`repop`)
// a kernel that lands without a hit pops once more for `repopDamage` of its damage. Not a projectile pattern of Fan / Duct Tape / Multipack (`PROJECTILE_PATTERNS`).
const W = weaponBase({ pattern: 'popcorn', damage: 3, cooldown: 1.3, range: 240, projectileSpeed: 520, count: 6 });

export default defineItem({
  id: Item.popcorn, kind: 'weapon', sets: [Set.snacks, Set.blast], shape: '1x2', price: 13, tags: ['ranged'],
  weapon: W,
  tune: { ...weaponTiers(W), range: W.range, count: W.count, repop: [0, 0, 1], repopDamage: 0.5 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Popcorn Maker', blurb: 'Pop. Pop. Pop-pop-pop.', rules: 'Pops {count} kernels every {cooldown|s}, each at a random enemy in range. {damage} damage per kernel. {range} range.', star3: '★3: A kernel that lands without a hit pops once more at the nearest enemy for {repopDamage|pct} of its damage.' },
    de: { name: 'Popcornmaschine', blurb: 'Popp. Popp. Popp-popp-popp.', rules: 'Schießt alle {cooldown|s} {count} Körner, jedes auf einen zufälligen Gegner in Reichweite. {damage} Schaden pro Korn. {range} Reichweite.', star3: '★3: Ein Korn, das ohne Treffer landet, springt noch einmal auf den nächsten Gegner, mit {repopDamage|pct} seines Schadens.' },
  },
});
