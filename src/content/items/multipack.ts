import { defineItem, PROJECTILE_PATTERNS, resolveTune } from '../../engine/define';
import { Buff, Item, Set as S } from '../../engine/ids';

// extra projectiles are +1 / +1 / +2 per ★ (not linear: Gold Star's effective ★4 stays at `maxExtra`), melee damage scales linearly
// (20% base x TIER.mult). `repeats` = extra attacks for sweeps/cones/mortars; `repeatDelay` (s) is read by the arsenal.
const TUNE = { extra: [1, 1, 2], maxExtra: 2, damage: [0.2, 0.3, 0.4], repeats: 1, repeatDelay: 0.18 } as const;

/** Patterns whose attack can repeat. Everything that is neither a projectile nor one of these gets +damage instead. */
const REPEATING: ReadonlySet<string> = new Set(['sweep', 'cone', 'mortar']);

export default defineItem({
  id: Item.multipack, kind: 'module', sets: [S.snacks, S.blast], shape: '1x1', price: 13, buff: Buff.multipack,
  tune: TUNE,
  text: {
    en: { name: 'Multipack', blurb: 'Buy one, fire two.', rules: 'Any adjacent weapon: projectiles {extra|+int}, sweeps/cones/mortars attack one extra time, other weapons {damage|+pct} damage.' },
    de: { name: 'Multipack', blurb: 'Eins kaufen, zwei feuern.', rules: 'Jede angrenzende Waffe: Projektile {extra|+int}, Schwünge/Kegel/Mörser greifen einmal zusätzlich an, andere Waffen {damage|+pct} Schaden.' },
  },
  rows: [
    { label: { en: 'Extra shots', de: 'Extra-Schüsse' }, key: 'extra', fmt: '+int' },
    { label: { en: 'Melee damage', de: 'Nahkampfschaden' }, key: 'damage', fmt: '+pct' },
  ],
  // Two parts. `module`: the +damage for patterns that cannot repeat. `post-combo` (below): the count, which has to come after the
  // combos because Toast Mode *sets* the count.
  build: {
    phase: 'module', order: 100,
    weapon(w, c) {
      if (PROJECTILE_PATTERNS.has(w.pattern) || REPEATING.has(w.pattern)) return false; // not recorded here: the post-combo part records it
      w.damage *= 1 + c.tune().damage;
    },
  },
  extraBuild: [{
    phase: 'post-combo', order: 100,
    weapon(w, c) {
      const projectile = PROJECTILE_PATTERNS.has(w.pattern);
      if (!projectile && !REPEATING.has(w.pattern)) return;
      const touching = c.touching(w);
      if (!touching.length) return;
      // Post-combo hooks get the tier of the best copy in the whole cart; the count is decided by the best copy *touching* this weapon.
      const t = resolveTune(TUNE, Math.max(...touching.map((n) => n.tier)));
      w.count += projectile ? Math.min(t.extra, t.maxExtra) : t.repeats;
      w.buffs.push(Buff.multipack);
    },
  }],
});
