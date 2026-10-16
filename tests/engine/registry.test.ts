import { describe, expect, it } from 'vitest';
import { ITEM_IDS } from '../../src/data/items';
import { RECIPES } from '../../src/data/recipes';
import { BUILD_PHASES, defineCombo, defineItem, defineSet } from '../../src/engine/define';
import { ContentError, assertRegistry, contentCombos, contentItem, contentItems, contentSets, createRegistry, validateContent } from '../../src/engine/registry';
import { BUFF_ORDER } from '../../src/systems/synergies';
import type { ItemTypeId, RecipeId } from '../../src/types';

// Fixture content (inline, not files in src/content). Ids are real union members; the registry never looks at src/content here.
const item = (over: Record<string, unknown> = {}) => defineItem({
  id: 'fuel', kind: 'module', sets: ['tools', 'heat'], shape: '1x2', price: 11, buff: 'fuel',
  tune: { dps: [2.5, 3.75, 5], duration: 2 },
  rows: [{ label: { en: 'Burn', de: 'Brand' }, key: 'dps', fmt: 'ps' }],
  text: {
    en: { name: 'Fuel Can', blurb: 'Hot.', rules: 'Burn {dps|ps} for {duration|s}.' },
    de: { name: 'Benzinkanister', blurb: 'Heiß.', rules: 'Brand {dps|ps} für {duration|s}.' },
  },
  build: { phase: 'module', weapon() {} },
  ...over,
} as never);
const combo = (over: Record<string, unknown> = {}) => defineCombo({
  id: 'greaseFire', requires: ['mop', 'fuel'],
  tune: { radiusMult: 1.4, burnMult: 2 },
  text: {
    en: { name: 'Grease Fire', short: 'Huge slicks', summary: 'Mop + Fuel.', detail: 'Puddles get {radiusMult|pct} bigger and burn ×{burnMult}.' },
    de: { name: 'Fettbrand', short: 'Riesige Lachen', summary: 'Mopp + Benzin.', detail: 'Pfützen werden {radiusMult|pct} größer und brennen ×{burnMult}.' },
  },
  ...over,
} as never);
const set = (over: Record<string, unknown> = {}) => defineSet({
  id: 'kitchen', tune: { damageMult: [1.1, 1.1, 1.2] },
  text: {
    en: { name: 'Kitchen', bonus: ['+{damageMult|pct} damage', '+{damageMult|pct} damage', '+{damageMult|pct} damage'] },
    de: { name: 'Küche', bonus: ['+{damageMult|pct} Schaden', '+{damageMult|pct} Schaden', '+{damageMult|pct} Schaden'] },
  },
  ...over,
} as never);

const errors = (files: Parameters<typeof validateContent>[0], opts?: Parameters<typeof validateContent>[1]) => validateContent(files, opts).join('\n');

describe('validateContent', () => {
  it('accepts valid items, combos and sets', () => {
    expect(validateContent({ items: { 'items/fuel.ts': item() }, combos: { 'combos/greaseFire.ts': combo() }, sets: { 'sets/kitchen.ts': set() } })).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(errors({ items: { 'items/fuel.ts': item(), 'items/other/fuel.ts': item() } })).toMatch(/duplicate item id "fuel" \(also in items\/fuel\.ts\)/);
    expect(errors({ combos: { 'combos/greaseFire.ts': combo(), 'combos/x/greaseFire.ts': combo() } })).toMatch(/duplicate combo id "greaseFire"/);
  });

  it('rejects a filename that does not match the id', () => {
    expect(errors({ items: { 'items/oil.ts': item() } })).toMatch(/items\/oil\.ts: filename must match the id "fuel"/);
    expect(errors({ combos: { 'combos/fire.ts': combo() } })).toMatch(/filename must match/);
    expect(errors({ sets: { 'sets/cleaning.ts': set() } })).toMatch(/filename must match/);
  });

  it('resolves a combo\'s requires against content and the known (legacy) ids', () => {
    const files = { combos: { 'combos/greaseFire.ts': combo() } };
    expect(errors(files, { knownItemIds: ['mop', 'fuel'] })).toBe('');
    expect(errors(files, { knownItemIds: ['mop'] })).toMatch(/requires unknown item "fuel"/);
    expect(errors({ ...files, items: { 'items/fuel.ts': item() } }, { knownItemIds: ['mop'] })).toBe(''); // fuel comes from content
    expect(errors(files)).toBe(''); // no list given: not checked
  });

  it('resolves replaces against known combos', () => {
    const files = { combos: { 'combos/greaseFire.ts': combo({ replaces: ['nailstorm'] }) } };
    expect(errors(files, { knownItemIds: ['mop', 'fuel'], knownComboIds: ['nailstorm'] })).toBe('');
    expect(errors(files, { knownItemIds: ['mop', 'fuel'], knownComboIds: [] })).toMatch(/replaces unknown combo "nailstorm"/);
  });

  it('requires every text placeholder to exist in tune', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ text: { en: { name: 'F', blurb: 'b', rules: 'Burn {dmg|ps}.' }, de: { name: 'F', blurb: 'b', rules: 'Brand {dmg|ps}.' } } }) } })).toMatch(/text\.en\.rules uses \{dmg\} but tune has no "dmg"/);
    expect(errors({ combos: { 'combos/greaseFire.ts': combo({ tune: { radiusMult: 1.4 } }) } })).toMatch(/text\.en\.detail uses \{burnMult\} but tune has no "burnMult"/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ tune: {} }) } })).toMatch(/uses \{damageMult\} but tune has no/);
  });

  it('requires EN and DE to use the same placeholders, and a valid formatter', () => {
    const bad = item({ text: { en: { name: 'F', blurb: 'b', rules: 'Burn {dps|ps}.' }, de: { name: 'F', blurb: 'b', rules: 'Brand.' } } });
    expect(errors({ items: { 'items/fuel.ts': bad } })).toMatch(/text\.en\.rules and text\.de\.rules use different placeholders/);
    expect(errors({ items: { 'items/fuel.ts': item({ text: { en: { name: 'F', blurb: 'b', rules: 'Burn {dps|zzz}.' }, de: { name: 'F', blurb: 'b', rules: 'Brand {dps|zzz}.' } } }) } })).toMatch(/unknown formatter "zzz"/);
    expect(errors({ items: { 'items/fuel.ts': item({ text: { en: item().text.en } }) } })).toMatch(/text needs both "en" and "de"/);
  });

  it('checks per-tier arrays', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ tune: { dps: [2.5, 3.75], duration: 2 } }) } })).toMatch(/tune\.dps must be a number or an array of exactly 3 numbers/);
    expect(errors({ items: { 'items/fuel.ts': item({ tune: { dps: [1, 2, 3, 4], duration: 2 } }) } })).toMatch(/exactly 3/);
    expect(errors({ items: { 'items/fuel.ts': item({ legendary: true }) } })).toMatch(/tune\.dps is per-tier, but this content has no tiers/);
    expect(errors({ combos: { 'combos/greaseFire.ts': combo({ tune: { radiusMult: [1, 2, 3], burnMult: 2 } }) } })).toMatch(/per-tier/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ tune: { damageMult: [1, 2] } }) } })).toMatch(/exactly 3/);
  });

  it('requires a row for every per-tier placeholder in the rules (legacy {0}, {1} form)', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ rows: undefined }) } })).toMatch(/per-tier placeholder \{dps\|ps\}.*has no matching row/);
  });

  it('checks rows, build phases and module requirements', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ rows: [{ label: { en: 'x', de: 'x' }, key: 'nope' }] }) } })).toMatch(/rows: no tune key "nope"/);
    expect(errors({ items: { 'items/fuel.ts': item({ build: { phase: 'combo', weapon() {} } }) } })).toMatch(/build\.phase "combo" is not valid for item content/);
    expect(errors({ combos: { 'combos/greaseFire.ts': combo({ build: { phase: 'set', weapon() {} } }) } })).toMatch(/build\.phase "set" is not valid for combo content/);
    expect(errors({ items: { 'items/fuel.ts': item({ buff: undefined }) } })).toMatch(/needs `buff`/);
    expect(errors({ items: { 'items/fuel.ts': item({ build: { phase: 'module', player() {} } }) } })).toMatch(/module-phase item needs a weapon hook/);
    expect(errors({ items: { 'items/fuel.ts': item({ build: { phase: 'module' } }) } })).toMatch(/needs a weapon and\/or player hook/);
    expect(errors({ items: { 'items/fuel.ts': item({ build: { phase: 'global-mod', player() {} } }) } })).toMatch(/only a player hook must use phase "final"/);
    expect(errors({ items: { 'items/fuel.ts': item({ extraBuild: [{ phase: 'module', weapon() {} }] }) } })).toMatch(/extraBuild cannot use the module phase/);
    expect(errors({ items: { 'items/fuel.ts': item({ extraBuild: [{ phase: 'combo', weapon() {} }] }) } })).toMatch(/build\.phase "combo" is not valid for item content/);
    expect(errors({ items: { 'items/fuel.ts': item({ extraBuild: [{ phase: 'post-combo', weapon() {} }] }) } })).toBe('');
  });

  it('checks the item core fields', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ price: 0 }) } })).toMatch(/price must be a positive number/);
    expect(errors({ items: { 'items/fuel.ts': item({ kind: 'weapon' }) } })).toMatch(/a weapon needs a weapon definition/);
    expect(errors({ items: { 'items/fuel.ts': item({ shape: () => '0x0' }) } })).toMatch(/shape is empty/);
    expect(errors({ sets: { 'sets/nope.ts': set({ id: 'nope' }) } })).toMatch(/unknown set id "nope"/);
  });
});

describe('createRegistry', () => {
  it('indexes valid content and throws a ContentError listing every problem', () => {
    const reg = createRegistry({ items: { 'items/fuel.ts': item() }, combos: { 'combos/greaseFire.ts': combo() }, sets: { 'sets/kitchen.ts': set() } });
    expect(reg.item('fuel')?.price).toBe(11);
    expect(reg.combo('greaseFire')?.requires).toEqual(['mop', 'fuel']);
    expect(reg.set('kitchen')).toBeDefined();
    expect(reg.item('nope')).toBeUndefined();
    expect(() => createRegistry({ items: { 'items/oil.ts': item({ price: 0 }) } })).toThrow(ContentError);
    try { createRegistry({ items: { 'items/oil.ts': item({ price: 0 }) } }); } catch (e) { expect((e as ContentError).problems).toHaveLength(2); }
  });
});

describe('the real registry', () => {
  it('loads and validates src/content against the legacy tables', () => {
    expect(() => assertRegistry({ knownItemIds: ITEM_IDS, knownComboIds: Object.keys(RECIPES) })).not.toThrow();
    for (const c of contentItems()) expect(ITEM_IDS, c.id).toContain(c.id);
    for (const c of contentCombos()) expect(Object.keys(RECIPES), c.id).toContain(c.id);
    expect(contentSets().length).toBeGreaterThanOrEqual(0);
  });
  it('collects the pilot item', () => {
    expect(contentItem('hotsauce')?.build?.phase).toBe('module');
  });
  it('keeps module-phase `order` in line with BUFF_ORDER (the loop that runs them)', () => {
    const mods = contentItems().filter((c) => c.build?.phase === 'module');
    const byOrder = [...mods].sort((a, b) => (a.build!.order ?? 0) - (b.build!.order ?? 0)).map((c) => c.buff);
    const byLoop = BUFF_ORDER.filter((b) => mods.some((c) => c.buff === b));
    expect(byOrder).toEqual(byLoop);
  });
  it('only uses known phases', () => {
    for (const c of [...contentItems(), ...contentSets(), ...contentCombos()]) if (c.build) expect(BUILD_PHASES).toContain(c.build.phase);
  });
  it('type check: ids stay in the unions', () => {
    const a: ItemTypeId = contentItems()[0].id, b: RecipeId | undefined = contentCombos()[0]?.id;
    expect(a).toBeTruthy();
    expect(b === undefined || typeof b === 'string').toBe(true);
  });
});
