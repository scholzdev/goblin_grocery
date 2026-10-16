import { expect } from 'vitest';
import { contentSet } from '../../../src/engine/registry';
import type { CombatEnemy } from '../../../src/engine/ctx';
import type { HitEvent, HitOpts } from '../../../src/engine/hooks';
import { setBonusT, tagT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { combatRng } from '../../../src/systems/rng';
import type { SetId, WeaponStats } from '../../../src/types';

// Shared by the per-set content tests (tests/content/sets/<id>.test.ts).

/** First seed whose first combat draws satisfy `ok` in order (the first predicate on the first draw, the next on the second ...). */
export const seedWhere = (...ok: ((r: number) => boolean)[]): number => {
  for (let seed = 1; seed < 20000; seed++) { const r = combatRng(seed, 0); if (ok.every((f) => f(r()))) return seed; }
  throw new Error('no seed');
};
/** The first `n` numbers the arena's combat rng gives for `seed` (aisle 0). */
export const draws = (seed: number, n: number): number[] => { const r = combatRng(seed, 0); return Array.from({ length: n }, () => r()); };

/** A `HitEvent` for emitting `afterHit` by hand (the fake only builds one inside `hit`, where `kbMult` is not visible to a test). */
export const hitOf = (enemy: CombatEnemy, stats: WeaponStats | null, opts: HitOpts = {}, dmg = 5): HitEvent => ({
  enemy, base: dmg, dmg, stats, opts, source: stats?.uid ?? 'shove', now: 0, direct: !opts.isDot && !opts.echo && !opts.fromPopper && !opts.chained, crit: false, armored: false, killed: false, kbMult: 1,
});

/**
 * The content file is registered and its text renders to exactly these strings, in both languages (the strings are the legacy `set_*`
 * keys of i18n/ui.ts filled in the old way: pc(...) / fmtNum(...)).
 */
export function expectSetText(id: SetId, expected: { en: { name: string; bonus: [string, string, string] }; de: { name: string; bonus: [string, string, string] } }): void {
  expect(contentSet(id)?.id).toBe(id);
  for (const lang of ['en', 'de'] as const) {
    setLang(lang);
    try {
      expect(tagT(id), `${id} name ${lang}`).toBe(expected[lang].name);
      ([1, 2, 3] as const).forEach((lv, i) => expect(setBonusT(id, lv), `${id} L${lv} ${lang}`).toBe(expected[lang].bonus[i]));
    } finally { setLang('en'); }
  }
}
