import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import { RECIPES, RECIPE_ORDER } from '../../../src/data/recipes';
import { resolveTune, type BuildCtx, type ComboContent as Combo } from '../../../src/engine/define';
import { contentCombo } from '../../../src/engine/registry';
import { recipeT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild } from '../../../src/systems/synergies';
import { combatRng } from '../../../src/systems/rng';
import type { ItemTypeId, RecipeId, WeaponStats } from '../../../src/types';
import { build, type Spec } from '../../golden/carts';
import { at, stats as statsOf } from '../helpers';

export { arena, at, far, full } from '../helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComboContent = Combo<any>;

// Shared by the per-combo content tests (tests/content/combos/<id>.test.ts).

/** The combo's parts as a cart: the weapon first (or the cart anchor), every other part touching it. */
export const partsOf = (mod: ComboContent): Spec[] => mod.requires.map((t) => at(t as ItemTypeId));

/** Combo ids active in the cart (8x6, so everything fits). */
export const activeIn = (specs: Spec[]): RecipeId[] => computeBuild(build(specs, 8, 6)).recipes.map((r) => r.id);

/** The stats of the cart's first weapon. */
export const weaponOf = (specs: Spec[]): WeaponStats => computeBuild(build(specs, 8, 6)).weapons[0];

/** The weapon alone (no combo, no module): what the combo's build hook starts from. */
export const bare = (type: ItemTypeId): WeaponStats => statsOf([at(type)]);

/** Run only the combo's own `combo`-phase build hook on a copy of `w` (the hook is pure: stats in, stats out). */
export function applyCombo(mod: ComboContent, w: WeaponStats, tapeArc = 0): WeaponStats {
  const out = structuredClone(w), tune = resolveTune(mod.tune, 1);
  mod.build!.weapon!(out, { tier: 1, tune: () => tune, tapeArc, def: (id: ItemTypeId) => ITEMS[id] } as unknown as BuildCtx);
  return out;
}

const DECOYS: ItemTypeId[] = ['toaster', 'pan', 'nailgun', 'vacuum', 'microwave', 'blender', 'fizz', 'mop', 'laser', 'cooker', 'spray', 'leafblower'];

/**
 * The shared checks of every combo file: detection (all parts trigger it; dropping any one part, or swapping the weapon, does not),
 * the registered content, and the EN/DE name. `names` = [EN, DE].
 */
export function describeCombo(id: RecipeId, mod: ComboContent, names: [string, string]): void {
  describe(`${names[0]}: recipe`, () => {
    const specs = partsOf(mod);
    it('is the registered content file with the legacy RecipeDef converted from it', () => {
      expect(contentCombo(id)).toBe(mod);
      expect(mod.id).toBe(id);
      expect(RECIPE_ORDER).toContain(id);
      const def = RECIPES[id];
      expect(def.id).toBe(id);
      expect(mod.cart ? def.supports : [def.weapon, ...def.supports]).toEqual([...mod.requires]);
      expect(!!def.weapon).toBe(!mod.cart);
      expect(def.replaces).toEqual(mod.replaces ? [...mod.replaces] : undefined);
    });

    it('triggers with exactly its parts touching', () => {
      expect(activeIn(specs)).toContain(id);
      const b = computeBuild(build(specs, 8, 6));
      const r = b.recipes.find((x) => x.id === id)!;
      expect(r.weaponUid).toBe(mod.cart ? null : 'u0');
      expect(r.supportUids).toEqual((mod.cart ? specs : specs.slice(1)).map((_, i) => `u${i + (mod.cart ? 0 : 1)}`).sort());
      if (!mod.cart) expect(b.weapons[0].recipes).toContain(id);
    });

    it('does not trigger without any one of its parts', () => {
      for (let i = 0; i < specs.length; i++) expect(activeIn(specs.filter((_, j) => j !== i)), `without ${mod.requires[i]}`).not.toContain(id);
    });

    if (!mod.cart) {
      it('does not trigger on another weapon, or when a part does not touch the weapon', () => {
        const decoy = DECOYS.find((w) => w !== mod.requires[0])!;
        expect(activeIn([at(decoy), ...specs.slice(1)])).not.toContain(id);
        specs.slice(1).forEach((_, k) => {
          const apart = specs.map((s, j) => (j === k + 1 ? { ...s, near: [], apart: [0] } : s));
          expect(activeIn(apart), `${mod.requires[k + 1]} apart`).not.toContain(id);
        });
      });
    }

    it('has its EN and DE name', () => {
      try {
        setLang('en'); expect(recipeT(id).name).toBe(names[0]);
        setLang('de'); expect(recipeT(id).name).toBe(names[1]);
      } finally { setLang('en'); }
    });
  });
}

/** The first `n` numbers of the arena's combat rng for `seed` (aisle 0). */
export const draws = (seed: number, n: number): number[] => { const r = combatRng(seed, 0); return Array.from({ length: n }, () => r()); };
/** Is the next draw of the fake's rng the (n+1)-th of the stream? Proves a hook made exactly `n` draws. */
export const nextDraw = (seed: number, n: number): number => draws(seed, n + 1)[n];

/** Source text of a scene/engine file (for "the legacy branch is gone" guards). */
export const source = (path: string): string => {
  const all = import.meta.glob('../../../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const hit = Object.entries(all).find(([k]) => k.endsWith(`/src/${path}`));
  if (!hit) throw new Error(`no source ${path}`);
  return hit[1];
};
