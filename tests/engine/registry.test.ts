import { describe, expect, it } from 'vitest';
import { ITEM_IDS } from '../../src/data/items';
import { RECIPES } from '../../src/data/recipes';
import { BUFF_ORDER, BUILD_PHASES, HOOK_NAMES, ITEM_ORDER, RECIPE_ORDER, SET_ORDER, SET_THRESHOLDS, defineCombo, defineItem, defineSet } from '../../src/engine/define';
import { ContentError, SET_IDS, contentCombos, contentItem, contentItems, contentSet, contentSetTune, contentSets, createRegistry, validateContent } from '../../src/engine/registry';
import { renderText } from '../../src/engine/text';
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

  it('checks tierBoost (a positive scalar tune entry, known exclusions)', () => {
    const star = (over: Record<string, unknown>) => item({ tune: { tiers: 1 }, rows: undefined, text: { en: { name: 'S', blurb: 'x', rules: 'x' }, de: { name: 'S', blurb: 'x', rules: 'x' } }, buff: undefined, build: undefined, legendary: true, ...over });
    expect(errors({ items: { 'items/fuel.ts': star({ tierBoost: { key: 'tiers', excludes: ['weapon', 'legendary'] } }) } })).toBe('');
    expect(errors({ items: { 'items/fuel.ts': star({ tierBoost: { key: 'nope', excludes: [] } }) } })).toMatch(/tierBoost\.key "nope" must be a positive scalar tune entry/);
    expect(errors({ items: { 'items/fuel.ts': star({ tune: { tiers: [1, 1, 2] }, tierBoost: { key: 'tiers', excludes: [] } }) } })).toMatch(/tierBoost\.key "tiers"/);
    expect(errors({ items: { 'items/fuel.ts': star({ tierBoost: { key: 'tiers', excludes: ['passive'] } }) } })).toMatch(/tierBoost\.excludes may only list/);
  });

  it('checks the item core fields', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ price: 0 }) } })).toMatch(/price must be a positive number/);
    expect(errors({ items: { 'items/fuel.ts': item({ kind: 'weapon' }) } })).toMatch(/a weapon needs a weapon definition/);
    expect(errors({ items: { 'items/fuel.ts': item({ shape: () => '0x0' }) } })).toMatch(/shape is empty/);
    expect(errors({ sets: { 'sets/nope.ts': set({ id: 'nope' }) } })).toMatch(/unknown set id "nope"/);
  });
});

describe('validateContent: sets', () => {
  it('rejects duplicate set ids', () => {
    expect(errors({ sets: { 'sets/kitchen.ts': set(), 'sets/other/kitchen.ts': set() } })).toMatch(/duplicate set id "kitchen" \(also in sets\/kitchen\.ts\)/);
  });

  it('needs three bonus lines per language and both languages', () => {
    const short = { en: { name: 'Kitchen', bonus: ['a', 'b'] }, de: { name: 'Küche', bonus: ['a', 'b'] } };
    expect(errors({ sets: { 'sets/kitchen.ts': set({ text: short }) } })).toMatch(/bonus needs exactly 3 entries/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ text: { en: short.en } }) } })).toMatch(/bonus needs exactly 3 entries/);
  });

  it('resolves every placeholder of the name and the three bonus lines against the tune, EN and DE alike', () => {
    const text = (bonus: string[]) => ({ en: { name: 'Kitchen', bonus }, de: { name: 'Küche', bonus: ['+{damageMult|pctup} Schaden', '+{damageMult|pctup} Schaden', '+{damageMult|pctup} Schaden'] } });
    expect(errors({ sets: { 'sets/kitchen.ts': set({ text: text(['+{nope} damage', '+{damageMult|pctup} damage', '+{damageMult|pctup} damage']) }) } })).toMatch(/text\.en\.bonus\[0\] uses \{nope\} but tune has no "nope"/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ text: text(['+{damageMult|bogus} damage', '+{damageMult|pctup} damage', '+{damageMult|pctup} damage']) }) } })).toMatch(/unknown formatter "bogus"/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ text: text(['+{damageMult|pctup} damage', '+{damageMult|pctup} damage', '+{damageMult|pctup} damage']) }) } })).toBe('');
    expect(errors({ sets: { 'sets/kitchen.ts': set({ text: text(['+{damageMult|pctn} damage', '+{damageMult|pctup} damage', '+{damageMult|pctup} damage']) }) } })).toMatch(/bonus\[0\] and text\.de\.bonus\[0\] use different placeholders/);
  });

  it('only known hook names, functions, and a finite order; build phases set / post-combo / final', () => {
    expect(errors({ sets: { 'sets/kitchen.ts': set({ hooks: { onKilll() {} } }) } })).toMatch(/hooks\.onKilll is not a hook/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ hooks: { afterKill: 3 } }) } })).toMatch(/hooks\.afterKill must be a function/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ hooks: { order: Infinity } }) } })).toMatch(/hooks\.order must be a finite number/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ hooks: { order: 5, afterHit() {}, afterKill() {}, onDashHit() {} } }) } })).toBe('');
    expect(errors({ sets: { 'sets/kitchen.ts': set({ build: { phase: 'module', weapon() {} } }) } })).toMatch(/build\.phase "module" is not valid for set content/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ build: { phase: 'set', weapon() {} }, extraBuild: [{ phase: 'final', player() {} }] }) } })).toBe('');
    expect(errors({ sets: { 'sets/kitchen.ts': set({ extraBuild: [{ phase: 'base', weapon() {} }] }) } })).toMatch(/build\.phase "base" is not valid for set content/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ extraBuild: [{ phase: 'set', player() {} }] }) } })).toMatch(/only a player hook must use phase "final"/);
  });

  it('a set tune takes numbers or L1/L2/L3 triples only', () => {
    expect(errors({ sets: { 'sets/kitchen.ts': set({ tune: { damageMult: [1.1, 1.2] } }) } })).toMatch(/exactly 3/);
    expect(errors({ sets: { 'sets/kitchen.ts': set({ tune: { damageMult: NaN } }) } })).toMatch(/not a finite number/);
  });

  it('`elements` (extra hit tags): weapons and modules, real non-mark tags, no duplicates, nothing already in the sets', () => {
    const weapon = (over: Record<string, unknown> = {}) => item({ kind: 'weapon', sets: ['kitchen'], buff: undefined, build: undefined, weapon: { pattern: 'aura', damage: 2, cooldown: 0.3, range: 85 }, ...over });
    expect(errors({ items: { 'items/fuel.ts': item({ elements: ['heat'] }) } })).toBe('');
    expect(errors({ items: { 'items/fuel.ts': weapon({ elements: ['electric'] }) } })).toBe('');
    expect(errors({ items: { 'items/fuel.ts': item({ kind: 'passive', buff: undefined, build: { phase: 'final', player() {} }, elements: ['heat'] }) } })).toMatch(/`elements` is for weapons and modules only/);
    expect(errors({ items: { 'items/fuel.ts': item({ elements: [] }) } })).toMatch(/`elements` must be a non-empty list/);
    expect(errors({ items: { 'items/fuel.ts': item({ elements: ['mark'] }) } })).toMatch(/elements: "mark" is not a hit tag/);
    expect(errors({ items: { 'items/fuel.ts': item({ elements: ['fire'] }) } })).toMatch(/elements: "fire" is not a hit tag/);
    expect(errors({ items: { 'items/fuel.ts': item({ elements: ['heat', 'heat'] }) } })).toMatch(/lists a tag twice/);
    expect(errors({ items: { 'items/fuel.ts': weapon({ sets: ['kitchen', 'heat'], elements: ['heat'] }) } })).toMatch(/"heat" is already one of the sets/);
  });

  it('flavored items (Jelly Beans) take their element from the instance: no static element allowed', () => {
    expect(errors({ items: { 'items/fuel.ts': item({ flavored: true, sets: ['tools'] }) } })).toBe('');
    expect(errors({ items: { 'items/fuel.ts': item({ flavored: true }) } })).toMatch(/flavored items take their element from the instance/);
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
  it('loads src/content: one file per id of ITEM_ORDER and RECIPE_ORDER, nothing else', () => {
    expect(contentItems().map((c) => c.id).sort()).toEqual([...ITEM_ORDER].sort());
    expect(contentCombos().map((c) => c.id).sort()).toEqual([...RECIPE_ORDER].sort());
    expect(ITEM_IDS).toEqual([...ITEM_ORDER]);
    expect(Object.keys(RECIPES)).toEqual([...RECIPE_ORDER]);
  });
  it('fails when a content file is missing from an order list, or a listed id has no file', () => {
    const files = { items: { 'items/fuel.ts': item() }, combos: { 'combos/greaseFire.ts': combo({ requires: ['mop', 'fuel'] }) } };
    expect(errors(files, { itemOrder: ['fuel'], comboOrder: ['greaseFire'] })).toBe('');
    expect(errors(files, { itemOrder: ['fuel', 'mop'] })).toMatch(/ITEM_ORDER lists "mop", which has no content file/);
    expect(errors(files, { itemOrder: [] })).toMatch(/"fuel" is missing from ITEM_ORDER/);
    expect(errors(files, { comboOrder: [] })).toMatch(/"greaseFire" is missing from RECIPE_ORDER/);
  });
  it('has one content file per set, the nine of SET_ORDER, each id equal to its filename', () => {
    expect(contentSets().map((c) => c.id).sort()).toEqual([...SET_ORDER].sort());
    expect(SET_IDS).toEqual(SET_ORDER);
    for (const id of SET_ORDER) expect(contentSet(id)?.id).toBe(id);
    expect(SET_THRESHOLDS).toEqual([2, 3, 4]);
  });
  it('every set tune is a number or an L1/L2/L3 triple, and each bonus line renders at its level in EN and DE', () => {
    for (const c of contentSets()) {
      for (const [k, v] of Object.entries(c.tune ?? {})) expect(typeof v === 'number' || (Array.isArray(v) && v.length === 3), `${c.id}.${k}`).toBe(true);
      for (const lang of ['en', 'de'] as const) {
        expect(c.text[lang].bonus, `${c.id} ${lang}`).toHaveLength(3);
        c.text[lang].bonus.forEach((line, i) => expect(renderText(line, c.tune, i + 1, lang), `${c.id} L${i + 1} ${lang}`).not.toMatch(/[{}]/));
      }
      expect(contentSetTune(c.id, 3)).toBeDefined();
    }
  });
  it('set hook names are all real hooks, and only afterHit / afterKill / onDashHit / pattern:puddleEnter are used', () => {
    const used = new Set<string>();
    for (const c of contentSets()) for (const k of Object.keys(c.hooks ?? {})) { if (k !== 'order') { expect(HOOK_NAMES, `${c.id}.${k}`).toContain(k); used.add(k); } }
    expect([...used].sort()).toEqual(['afterHit', 'afterKill', 'onDashHit', 'pattern:puddleEnter']);
  });
  it('the set weapon bonuses run in this sequence: kitchen 10, cleaning 20, tools 30, heat 40, blast 50, electric 60 (set phase), frost last in post-combo', () => {
    const orders = Object.fromEntries(contentSets().filter((c) => c.build?.weapon).map((c) => [c.id, `${c.build!.phase}:${c.build!.order}`]));
    expect(orders).toEqual({ kitchen: 'set:10', cleaning: 'set:20', tools: 'set:30', heat: 'set:40', blast: 'set:50', electric: 'set:60', frost: 'post-combo:1000' });
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
