import { defineItem } from '../../engine/define';

// Legendary (★1 only). Two effects:
//  - the tier lift: modules and passives touching it work `tiers` effective tiers higher. It cannot be a build hook (it feeds
//    every other hook's tier), so it is declared with `tierBoost` and read by `eff()` in computeBuild (see engine/build.ts `tierBoostOf`).
//    No chaining: one lift however many stars touch the item; weapons and legendaries are never lifted.
//  - Bundle Deal: weapons touching it count `bundle` more items (the +6% per item itself stays in computeBuild).
const TIERS = 1;
const TIER_MAX = 3; // the shop's ★3 cap; a lifted ★3 works at TIER_MAX + TIERS

export default defineItem({
  id: 'goldstar', kind: 'module', sets: ['checkout'], shape: '1x1', price: 28, legendary: true,
  tune: { tiers: TIERS, maxTier: TIER_MAX + TIERS, bundle: 1 },
  text: {
    en: { name: 'Gold Star Sticker', blurb: 'Teacher\'s pet. Everything nearby tries harder.', rules: 'Modules and passives touching it work one tier higher (up to ★{maxTier|int} strength). Weapons touching it get +{bundle|int} Bundle Deal item.' },
    de: { name: 'Goldstern-Sticker', blurb: 'Lehrers Liebling. Alles in der Nähe gibt sich mehr Mühe.', rules: 'Module und Passive, die ihn berühren, wirken eine Stufe höher (bis zu ★{maxTier|int} Stärke). Waffen, die ihn berühren, erhalten +{bundle|int} Sparpaket-Gegenstand.' },
  },
  tierBoost: { key: 'tiers', excludes: ['weapon', 'legendary'] },
  build: {
    // Runs before the set bonuses; computeBuild then *adds* the distinct touching types to `bundle` (it starts at 0).
    // High `order`: it runs after the set hooks of the same phase.
    phase: 'set', order: 100,
    weapon(w, c) { if (c.touches(w)) w.bundle += c.tune().bundle; },
  },
});
