import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `pulse` (engine/patterns/pulse.ts): constant suction (`pull`) plus a damage pulse every cooldown. The coin pickup radius is this item's own `player` hook
// (it used to be `BUFFS.vacuumPickup` in `computeBuild`).
const W = weaponBase({ pattern: 'pulse', damage: 2, cooldown: 0.65, range: 150, pull: 70 });

export default defineItem({
  id: Item.vacuum, kind: 'weapon', sets: [Set.cleaning], shape: cells('###', '.#.'), price: 18, tags: ['area'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), pickup: 60 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Vacuum', blurb: 'Sucks groceries closer. Sucks coins closer too.', rules: 'Constantly pulls nearby enemies toward the cart. Every {cooldown|s}, enemies in range take {damage} damage. +{pickup} coin pickup radius.' },
    de: { name: 'Staubsauger', blurb: 'Saugt Gegner heran. Münzen übrigens auch.', rules: 'Zieht Gegner in der Nähe ständig zum Wagen. Alle {cooldown|s} erleiden Gegner im Radius {damage} Schaden. +{pickup} Münz-Sammelradius.' },
  },
  build: {
    // The coin pickup radius (the old `BUFFS.vacuumPickup` literal in `computeBuild`): added to the player build like Magnet's.
    phase: 'final',
    player(b, c) { b.pickupRadius += c.tune().pickup; },
  },
});
