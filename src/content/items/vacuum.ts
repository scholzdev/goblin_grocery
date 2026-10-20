import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `pulse` (engine/patterns/pulse.ts): constant suction (`pull`) plus a damage pulse every cooldown; from ★3 the pulse knocks the groceries within
// `nozzle` of the cart's edge back out (`blowback`). The coin pickup radius is this item's own `player` hook (it used to be `BUFFS.vacuumPickup` in `computeBuild`).
const W = weaponBase({ pattern: 'pulse', damage: 2, cooldown: 0.65, range: 150, pull: 70 });

export default defineItem({
  id: Item.vacuum, kind: 'weapon', sets: [Set.cleaning], shape: cells('###', '.#.'), price: 18, tags: ['area'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), pickup: 60, charges: 1, suckSeconds: 2, suckPull: 3, suckRange: 2, nozzle: 40, blowback: 150 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Vacuum', blurb: 'Utility weapon. Sucks groceries closer, and coins too.', rules: 'Constantly pulls nearby enemies toward the cart. Every {cooldown|s}, enemies in range take {damage} damage. +{pickup} coin pickup radius. Active (E, {charges} per aisle): Full Suck, for {suckSeconds|s} the pull is x{suckPull} and the range x{suckRange}, and every coin on screen flies to you.', star3: '★3: Each damage pulse knocks the groceries right at the cart back out.' },
    de: { name: 'Staubsauger', blurb: 'Hilfswaffe. Saugt Gegner heran, Münzen übrigens auch.', rules: 'Zieht Gegner in der Nähe ständig zum Wagen. Alle {cooldown|s} erleiden Gegner im Radius {damage} Schaden. +{pickup} Münz-Sammelradius. Aktiv (E, {charges} pro Gang): Volle Saugkraft, {suckSeconds|s} lang x{suckPull} Sog und x{suckRange} Reichweite, und alle Münzen im Bild fliegen zu dir.', star3: '★3: Jeder Schadensstoß stößt die Gegner direkt am Wagen zurück.' },
  },
  active: {
    // Full Suck: the pulse pattern reads the boost (WeaponRt.boost); the passive pull and damage are untouched.
    use(ctx, c) {
      const t = c.tune();
      ctx.boostWeapon(c.uid, { pull: t.suckPull, range: t.suckRange }, t.suckSeconds);
      ctx.pullCoins();
      ctx.sound('vacuum_pulse', { rate: 0.7 });
    },
  },
  build: {
    // The coin pickup radius (the old `BUFFS.vacuumPickup` literal in `computeBuild`): added to the player build like Magnet's.
    phase: 'final', order: 10,
    player(b, c) { b.pickupRadius += c.tune().pickup; },
  },
});
