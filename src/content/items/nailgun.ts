import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `burst` (engine/patterns/burst.ts): `count` nails, `burstInterval` apart, each with a little spread (one rng draw per nail).
// Nailstorm and Ray Gun reshape the nails through `pattern:fire` / `pattern:shotHit` / `pattern:shotMove`.
const W = weaponBase({ pattern: 'burst', damage: 3, cooldown: 1.1, range: 480, projectileSpeed: 760, count: 3, burstInterval: 0.08 });

export default defineItem({
  id: Item.nailgun, kind: 'weapon', sets: [Set.tools, Set.blast], shape: '2x1', price: 16, tags: ['ranged'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, spreadNails: [0, 0, 1], focusBonus: 0.08, focusCap: 5, focusWindow: 1.5 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Nail Gun', blurb: 'Rat-a-tat three-nail bursts.', rules: 'Fires a three-nail burst every {cooldown|s}. {damage} damage per nail. {range} range.', star3: '★3: The nails of a burst spread out over different enemies.' },
    de: { name: 'Nagelpistole', blurb: 'Ratatatat, Dreier-Nagelsalven.', rules: 'Feuert alle {cooldown|s} eine Dreier-Nagelsalve. {damage} Schaden pro Nagel. {range} Reichweite.', star3: '★3: Die Nägel einer Salve verteilen sich auf verschiedene Gegner.' },
  },
  hooks: {
    modifyDamage(hit, _ctx, c) {
      const w = hit.stats;
      if (w?.type !== Item.nailgun || !hit.direct) return;
      const tracks: Map<string, { target: number; hits: number; until: number }> = c.state.focus ??= new Map();
      const t = c.tune(), prev = tracks.get(w.uid);
      const hits = prev?.target === hit.enemy.id && prev.until > hit.now ? Math.min(t.focusCap, prev.hits + 1) : 0;
      tracks.set(w.uid, { target: hit.enemy.id, hits, until: hit.now + t.focusWindow });
      hit.dmg *= 1 + hits * t.focusBonus;
    },
  },
});
