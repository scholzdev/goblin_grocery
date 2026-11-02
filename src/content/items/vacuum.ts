import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `pulse` (engine/patterns/pulse.ts): constant suction (`pull`) plus a damage pulse every cooldown. The coin pickup radius is this item's own `player` hook.
const W = weaponBase({ pattern: 'pulse', damage: 2, cooldown: 0.65, range: 150, pull: 70 });

export default defineItem({
  id: Item.vacuum, kind: 'weapon', sets: [Set.cleaning], shape: cells('###', '.#.'), price: 18, tags: ['area'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), pickup: 60, everyDash: 3, suckSeconds: 2, suckPull: 3, suckRange: 2, nozzle: 40, blowback: 150 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Vacuum', blurb: 'Utility weapon. Sucks groceries closer, and coins too.', rules: 'Constantly pulls nearby enemies toward the cart. Every {cooldown|s}, enemies in range take {damage} damage. +{pickup} coin pickup radius. Every {everyDash} dashes in an aisle trigger Full Suck: for {suckSeconds|s} the pull is x{suckPull} and the range x{suckRange}, and every coin on screen flies to you.', star3: '★3: Each damage pulse knocks the groceries right at the cart back out.' },
    de: { name: 'Staubsauger', blurb: 'Hilfswaffe. Saugt Gegner heran, Münzen übrigens auch.', rules: 'Zieht Gegner in der Nähe ständig zum Wagen. Alle {cooldown|s} erleiden Gegner im Radius {damage} Schaden. +{pickup} Münz-Sammelradius. Alle {everyDash} Dashes in einem Gang lösen die volle Saugkraft aus: {suckSeconds|s} lang x{suckPull} Sog und x{suckRange} Reichweite, und alle Münzen im Bild fliegen zu dir.', star3: '★3: Jeder Schadensstoß stößt die Gegner direkt am Wagen zurück.' },
  },
  hooks: {
    // Full Suck: every `everyDash`-th dash of an aisle (`c.state` is fresh per aisle; the count is per vacuum). The pulse pattern reads the boost (WeaponRt.boost).
    onDashStart(_ev, ctx, c) {
      const t = c.tune(), n: Record<string, number> = (c.state.dashes ??= {});
      for (const inst of c.instances) {
        n[inst.uid] = (n[inst.uid] ?? 0) + 1;
        if (n[inst.uid] % t.everyDash) continue;
        ctx.boostWeapon(inst.uid, { pull: t.suckPull, range: t.suckRange }, t.suckSeconds);
        ctx.pullCoins();
        ctx.sound('vacuum_pulse', { rate: 0.7 });
      }
    },
  },
  build: {
    // The coin pickup radius (the old `BUFFS.vacuumPickup` literal in `computeBuild`): added to the player build like Magnet's.
    phase: 'final', order: 10,
    player(b, c) { b.pickupRadius += c.tune().pickup; },
  },
});
