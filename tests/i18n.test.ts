import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n/lang';
import { DATA_DE } from '../src/i18n/data-de';
import { cartSkinT, deptT, enemyT, goblinSkinT, itemRules, itemT, recipeT, shiftT, starterT, tagT, unlockNeedT } from '../src/i18n/data';
import { tierScaling } from '../src/systems/synergies';
import { ITEMS, PLAYER } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { ENEMIES } from '../src/data/enemies';
import { UI } from '../src/i18n/ui';
import { MODIFIERS } from '../src/data/modifiers';
import { DEPARTMENTS } from '../src/data/departments';
import { SHIFTS } from '../src/data/waves';
import { CART_SKINS, GOBLIN_SKINS, UNLOCKS } from '../src/data/unlocks';

const nonEmpty = (o: Record<string, string>) => Object.values(o).every((v) => typeof v === 'string' && v.length > 0);
const nums = (s: string) => (s.replace(/(\d),(\d)/g, '$1.$2').match(/\d+(\.\d+)?/g) ?? []);

afterEach(() => setLang('en'));

describe('German data', () => {
  it('covers every id with non-empty fields', () => {
    const tables: [Record<string, unknown>, Record<string, Record<string, string>>][] = [
      [ITEMS, DATA_DE.items], [RECIPES, DATA_DE.recipes], [ENEMIES, DATA_DE.enemies], [DEPARTMENTS, DATA_DE.departments],
      [PLAYER.starters, DATA_DE.starters], [GOBLIN_SKINS, DATA_DE.goblinSkins], [CART_SKINS, DATA_DE.cartSkins],
    ];
    for (const [en, de] of tables) for (const id of Object.keys(en)) { expect(de[id], id).toBeDefined(); expect(nonEmpty(de[id]), id).toBe(true); }
    expect(DATA_DE.shifts).toHaveLength(SHIFTS.length);
    DATA_DE.shifts.forEach((s) => expect(nonEmpty(s)).toBe(true));
    for (const u of UNLOCKS) expect(DATA_DE.unlocks[u.id], u.id).toBeTruthy();
    for (const t of ['ranged', 'melee', 'area', 'electric', 'kitchen', 'cleaning', 'tools', 'snacks', 'checkout', 'heat', 'frost', 'blast']) expect(DATA_DE.tags[t]).toBeTruthy();
  });

  it('fills item rule placeholders for every level, EN and DE, with the same set', () => {
    const ph = (x: string) => (x.match(/\{\d\}/g) ?? []).sort().join();
    for (const id of Object.keys(ITEMS) as (keyof typeof ITEMS)[]) {
      expect(ph(DATA_DE.items[id].rules), id).toBe(ph(ITEMS[id].rules));
      for (const l of ['en', 'de'] as const) {
        setLang(l);
        for (const tier of [1, 2, 3]) expect(itemRules(id, tier), `${id} ${l} ★${tier}`).not.toMatch(/[{}]/);
      }
    }
    setLang('en');
    expect(itemRules('boot', 2)).toContain(tierScaling('boot')[0].values[1]);
    expect(itemRules('boot', 2)).not.toBe(itemRules('boot', 1));
  });

  it('keeps every number from the English item rules', () => {
    for (const id of Object.keys(ITEMS) as (keyof typeof ITEMS)[]) {
      const de = nums(DATA_DE.items[id].rules);
      for (const n of nums(ITEMS[id].rules)) expect(de, `${id}: ${n}`).toContain(n);
    }
  });

  it('accessors switch with the language', () => {
    expect(itemT('toaster').name).toBe('Toaster');
    expect(unlockNeedT('microwave')).toBe('Reach aisle 4');
    expect(tagT('melee')).toBe('Melee');
    setLang('de');
    expect(itemT('pan').name).toBe('Bratpfanne');
    expect(recipeT('toastMode').name).toBe('Toast-Modus');
    expect(enemyT('boss').name).toBe('Der Filialleiter');
    expect(deptT('bakery').name).toBe('Bäckerei');
    expect(shiftT(4).name).toBe('Black Friday');
    expect(starterT('pan').name).toBe('Küchenchef');
    expect(goblinSkinT('gold').name).toBe('Mitarbeiter des Monats');
    expect(cartSkinT('chrome').name).toBe('Filialwagen');
    expect(unlockNeedT('microwave')).toBe('Erreiche Gang 4');
    expect(tagT('melee')).toBe('Nahkampf');
  });
});

describe('modifier texts', () => {
  it('have German names/effects with the same numbers as English', () => {
    for (const id of Object.keys(MODIFIERS)) {
      for (const p of ['modName', 'modShort', 'modFx', 'modRw']) {
        const k = `${p}_${id}` as keyof typeof UI.en;
        expect(UI.de[k], k).toBeTruthy();
        expect(nums(UI.de[k]), k).toEqual(nums(UI.en[k]));
      }
    }
  });
});
