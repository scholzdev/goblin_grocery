import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ITEM_IDS } from '../../src/data/items';
import { RECIPES } from '../../src/data/recipes';
import { contentItem } from '../../src/engine/registry';
import { itemRules, itemT, recipeT, tagT } from '../../src/i18n/data';
import { LANGS, setLang, type Lang } from '../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../src/systems/synergies';
import type { SetId } from '../../src/types';
import { goldenCarts } from './carts';
import { legacyRules } from './legacyRules';
import { stable } from './serialize';

/**
 * Golden snapshot of all player-facing item/combo/set text in EN and DE, rendered through the real functions
 * (itemT, itemRules, tierScaling, recipeT, setBonus, describeBuffs). A diff in __snapshots__/text.json means text changed.
 * `rules` is the item's template with `{0}`/`{1}` for the scaling rows (./legacyRules): it is what the snapshot has always held.
 */
const SET_IDS: SetId[] = ['kitchen', 'cleaning', 'tools', 'snacks', 'checkout', 'heat', 'frost', 'blast', 'electric'];

let setBonus: (id: SetId, lv: 1 | 2 | 3) => string;
beforeAll(async () => {
  // ui/shop.ts reads `location` at import time (via lab.ts); there is no DOM in the node test env.
  vi.stubGlobal('location', { search: '' });
  setBonus = (await import('../../src/ui/shop')).setBonus;
});
afterAll(() => { setLang('en'); vi.unstubAllGlobals(); });

const inLang = <T>(l: Lang, f: () => T): T => { setLang(l); try { return f(); } finally { setLang('en'); } };

describe('golden: text', () => {
  it('snapshots items, combos, sets and buff lines (EN + DE)', async () => {
    const out: Record<string, unknown> = {};
    const carts = goldenCarts();
    for (const l of LANGS) {
      inLang(l, () => {
        for (const id of ITEM_IDS) {
          const { name, blurb } = itemT(id), c = contentItem(id)!, rules = legacyRules(c.text[l].rules, c, l);
          out[`items.${id}.${l}`] = {
            name, blurb, rules,
            rulesByTier: { 1: itemRules(id, 1), 2: itemRules(id, 2), 3: itemRules(id, 3) },
            tierScaling: tierScaling(id),
          };
        }
        for (const id of Object.keys(RECIPES) as (keyof typeof RECIPES)[]) out[`combos.${id}.${l}`] = recipeT(id);
        for (const id of SET_IDS) out[`sets.${id}.${l}`] = { name: tagT(id), L1: setBonus(id, 1), L2: setBonus(id, 2), L3: setBonus(id, 3) };
        // describeBuffs for every golden cart (build lines per weapon, with module tiers taken from the cart).
        for (const c of carts) {
          const b = computeBuild(c.inv, c.perk);
          out[`buffs.${c.name}.${l}`] = b.weapons.map((w) => ({ weapon: w.type, lines: describeBuffs(w, c.inv) }));
        }
      });
    }
    await expect(stable(out)).toMatchFileSnapshot('./__snapshots__/text.json');
  });

  it('leaves the language on EN afterwards', () => {
    expect(itemT('fan').name).toBe('Desk Fan');
  });
});
