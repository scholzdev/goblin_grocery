import type { ItemTypeId, RecipeId, SetId } from '../types';
import { BUILD_PHASES, ELEMENTS, FAMILIES, HOOK_NAMES, ITEM_ORDER, RECIPE_ORDER, SET_ORDER, resolveShape, resolveTune, type BuildPhase, type BuildSpec, type ComboContent, type ItemContent, type RuntimeHooks, type SetContent, type Tune } from './define';
import { isFormatter, placeholders, renderText } from './text';

// Collects every content file (src/content/{items,combos,sets}/<id>.ts, default export) and validates them.
// Adding a file is the only registration there is.

export interface ContentFiles {
  items: Record<string, ItemContent>;
  combos: Record<string, ComboContent>;
  sets: Record<string, SetContent>;
}

export interface ValidateOptions {
  /** Item ids that may be named by a combo's `requires` besides the given files. Skipped when omitted (fixtures). */
  knownItemIds?: readonly string[];
  /** Combo ids that may be named by `replaces` besides the given files. Skipped when omitted (fixtures). */
  knownComboIds?: readonly string[];
  /** The complete item list the game expects (`ITEM_ORDER`): every file must be listed and every listed id must have a file. */
  itemOrder?: readonly string[];
  /** The complete combo list (`RECIPE_ORDER`), checked the same way. */
  comboOrder?: readonly string[];
}

/** Every set id, in the shop's order (`SET_ORDER`). */
export const SET_IDS: readonly SetId[] = SET_ORDER;

const baseName = (path: string): string => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
const isTriple = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
const phasesFor: Record<'item' | 'combo' | 'set', readonly BuildPhase[]> = { item: BUILD_PHASES.filter((p) => p !== 'combo'), combo: ['combo'], set: ['set', 'post-combo', 'final'] };

/** Every problem found in the given files (empty = valid). Does not throw. */
export function validateContent(files: Partial<ContentFiles>, opts: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);

  const checkTune = (path: string, tune: Tune | undefined, arrays: boolean) => {
    for (const [k, v] of Object.entries(tune ?? {})) {
      if (typeof v === 'number') { if (!Number.isFinite(v)) err(path, `tune.${k} is not a finite number`); }
      else if (!arrays) err(path, `tune.${k} is per-tier, but this content has no tiers (use a scalar)`);
      else if (!isTriple(v)) err(path, `tune.${k} must be a number or an array of exactly 3 numbers (got ${JSON.stringify(v)})`);
    }
  };

  /** Placeholders of one template: formatter valid, key in tune. Returns them as sorted "key|fmt" for the EN/DE comparison. */
  const checkTemplate = (path: string, where: string, template: unknown, tune: Tune | undefined): string[] => {
    if (typeof template !== 'string' || template.length === 0) { err(path, `${where} must be a non-empty string`); return []; }
    return placeholders(template).map(({ key, fmt }) => {
      if (!(key in (tune ?? {}))) err(path, `${where} uses {${key}} but tune has no "${key}"`);
      if (!isFormatter(fmt)) err(path, `${where} uses unknown formatter "${fmt}" in {${key}|${fmt}}`);
      return `${key}|${fmt}`;
    }).sort();
  };

  const checkTexts = (path: string, text: { en: object; de: object } | undefined, fields: string[], tune: Tune | undefined) => {
    if (!text?.en || !text?.de) { err(path, 'text needs both "en" and "de"'); return; }
    for (const f of fields) {
      const en = checkTemplate(path, `text.en.${f}`, (text.en as Record<string, unknown>)[f], tune), de = checkTemplate(path, `text.de.${f}`, (text.de as Record<string, unknown>)[f], tune);
      if (en.join() !== de.join()) err(path, `text.en.${f} and text.de.${f} use different placeholders ([${en}] vs [${de}])`);
    }
  };

  const checkBuild = (path: string, build: BuildSpec | undefined, kind: keyof typeof phasesFor) => {
    if (!build) return;
    if (!phasesFor[kind].includes(build.phase)) err(path, `build.phase "${build.phase}" is not valid for ${kind} content (use ${phasesFor[kind].join(' | ')})`);
    if (!build.weapon && !build.player) err(path, 'build needs a weapon and/or player hook');
    if (!build.weapon && build.player && build.phase !== 'final') err(path, 'a build with only a player hook must use phase "final"');
    if (build.order !== undefined && !Number.isFinite(build.order)) err(path, 'build.order must be a finite number');
  };

  /** `hooks`: only known hook names (a typo would never fire), each a function; `order` finite. */
  const checkHooks = (path: string, hooks: RuntimeHooks | undefined) => {
    for (const [k, v] of Object.entries(hooks ?? {})) {
      if (k === 'order') { if (typeof v !== 'number' || !Number.isFinite(v)) err(path, 'hooks.order must be a finite number'); }
      else if (!(HOOK_NAMES as readonly string[]).includes(k)) err(path, `hooks.${k} is not a hook (${HOOK_NAMES.join(', ')})`);
      else if (typeof v !== 'function') err(path, `hooks.${k} must be a function`);
    }
  };

  const dup = (map: Map<string, string>, path: string, id: string, kind: string) => {
    const other = map.get(id);
    if (other) err(path, `duplicate ${kind} id "${id}" (also in ${other})`); else map.set(id, path);
  };

  // ---- items
  const itemSeen = new Map<string, string>(), itemIds = new Set<string>();
  for (const [path, c] of Object.entries(files.items ?? {})) {
    if (!c || typeof c !== 'object') { err(path, 'default export is not a content definition (use defineItem)'); continue; }
    dup(itemSeen, path, c.id, 'item'); itemIds.add(c.id);
    if (baseName(path) !== c.id) err(path, `filename must match the id "${c.id}"`);
    if (!(c.price > 0)) err(path, 'price must be a positive number');
    if (!(FAMILIES as readonly string[]).includes(c.sets?.[0])) err(path, `sets[0] must be a family (${FAMILIES.join(', ')})`);
    if (c.sets?.[1] !== undefined && !(ELEMENTS as readonly string[]).includes(c.sets[1])) err(path, `sets[1] must be an element (${ELEMENTS.join(', ')})`);
    if ((c.kind === 'weapon') !== !!c.weapon) err(path, c.kind === 'weapon' ? 'a weapon needs a weapon definition' : 'only weapons have a weapon definition');
    checkTune(path, c.tune, !c.legendary);
    checkTexts(path, c.text, ['name', 'blurb', 'rules'], c.tune);
    try {
      for (const tier of [1, 2, 3]) {
        const shape = typeof c.shape === 'function' ? c.shape(tier) : c.shape;
        if (resolveShape(shape).length === 0) err(path, `shape is empty at ★${tier}`);
      }
    } catch (e) { err(path, `shape is invalid: ${(e as Error).message}`); }
    if (c.rows && !c.legendary) {
      for (const r of c.rows) {
        if (!(r.key in (c.tune ?? {}))) err(path, `rows: no tune key "${r.key}"`);
        if (!isFormatter(r.fmt ?? 'n')) err(path, `rows: unknown formatter "${r.fmt}"`);
        if (!r.label?.en || !r.label?.de) err(path, `rows: row "${r.key}" needs an en and a de label`);
      }
    }
    checkBuild(path, c.build, 'item');
    checkHooks(path, c.hooks);
    if (c.flavored && c.sets?.length !== 1) err(path, 'flavored items take their element from the instance: sets must be just the family');
    if (c.tierBoost) {
      const v = c.tune?.[c.tierBoost.key];
      if (typeof v !== 'number' || !(v > 0)) err(path, `tierBoost.key "${c.tierBoost.key}" must be a positive scalar tune entry`);
      if (c.tierBoost.excludes.some((k) => k !== 'weapon' && k !== 'legendary')) err(path, 'tierBoost.excludes may only list "weapon" and "legendary"');
    }
    for (const extra of c.extraBuild ?? []) {
      checkBuild(path, extra, 'item');
      if (extra.phase === 'module') err(path, 'extraBuild cannot use the module phase (one module hook per item: put it in `build`)');
    }
    if (c.build?.phase === 'module') {
      if (!c.buff) err(path, 'a module-phase item needs `buff` (its BUFF_ORDER entry)');
      if (!c.build.weapon) err(path, 'a module-phase item needs a weapon hook');
    } else if (c.buff) err(path, '`buff` needs a module-phase build hook (the item grants that buff to touching weapons)');
    // Render once per tier so a bad value shows up here, not in the shop.
    try { for (const lang of ['en', 'de'] as const) for (const tier of [1, 2, 3]) renderText(c.text[lang].rules, c.tune, tier, lang); }
    catch (e) { err(path, (e as Error).message); }
  }

  // ---- combos
  const comboSeen = new Map<string, string>(), comboIds = new Set<string>();
  for (const [path, c] of Object.entries(files.combos ?? {})) {
    if (!c || typeof c !== 'object') { err(path, 'default export is not a content definition (use defineCombo)'); continue; }
    dup(comboSeen, path, c.id, 'combo'); comboIds.add(c.id);
    if (baseName(path) !== c.id) err(path, `filename must match the id "${c.id}"`);
    if (!Array.isArray(c.requires) || c.requires.length < 2) err(path, 'requires needs at least two item ids (a weapon and a support, or two cart parts)');
    if (opts.knownItemIds) {
      const known = new Set([...opts.knownItemIds, ...itemIds]);
      for (const id of c.requires ?? []) if (!known.has(id)) err(path, `requires unknown item "${id}"`);
    }
    if (opts.knownComboIds) {
      const known = new Set([...opts.knownComboIds, ...comboIds]);
      for (const id of c.replaces ?? []) if (!known.has(id)) err(path, `replaces unknown combo "${id}"`);
    }
    checkTune(path, c.tune, false);
    checkTexts(path, c.text, ['name', 'short', 'summary', 'detail'], c.tune);
    checkBuild(path, c.build, 'combo');
    checkHooks(path, c.hooks);
    if (c.build?.phase === 'combo' && !c.build.weapon && !c.cart) err(path, 'a weapon combo in the combo phase needs a weapon hook');
  }

  /** A content kind and its order list name the same ids. */
  const checkOrder = (kind: string, list: string, ids: Set<string>, order: readonly string[] | undefined) => {
    if (!order) return;
    for (const id of ids) if (!order.includes(id)) err(kind, `"${id}" is missing from ${list} (src/engine/define.ts)`);
    for (const id of order) if (!ids.has(id)) err(kind, `${list} lists "${id}", which has no content file (src/content/${kind}/${id}.ts)`);
  };
  checkOrder('items', 'ITEM_ORDER', itemIds, opts.itemOrder);
  checkOrder('combos', 'RECIPE_ORDER', comboIds, opts.comboOrder);

  // ---- sets
  const setSeen = new Map<string, string>();
  for (const [path, c] of Object.entries(files.sets ?? {})) {
    if (!c || typeof c !== 'object') { err(path, 'default export is not a content definition (use defineSet)'); continue; }
    dup(setSeen, path, c.id, 'set');
    if (baseName(path) !== c.id) err(path, `filename must match the id "${c.id}"`);
    if (!SET_IDS.includes(c.id)) err(path, `unknown set id "${c.id}"`);
    checkTune(path, c.tune, true);
    const bonus = (c.text?.en?.bonus ?? []) as readonly unknown[];
    if (bonus.length !== 3 || (c.text?.de?.bonus ?? []).length !== 3) err(path, 'text.*.bonus needs exactly 3 entries (L1, L2, L3)');
    else {
      checkTexts(path, c.text as never, ['name'], c.tune);
      for (let i = 0; i < 3; i++) {
        const en = checkTemplate(path, `text.en.bonus[${i}]`, c.text.en.bonus[i], c.tune), de = checkTemplate(path, `text.de.bonus[${i}]`, c.text.de.bonus[i], c.tune);
        if (en.join() !== de.join()) err(path, `text.en.bonus[${i}] and text.de.bonus[${i}] use different placeholders`);
      }
    }
    checkBuild(path, c.build, 'set');
    for (const extra of c.extraBuild ?? []) checkBuild(path, extra, 'set');
    checkHooks(path, c.hooks);
  }
  return errors;
}

export class ContentError extends Error {
  constructor(readonly problems: string[]) { super(`Invalid content:\n - ${problems.join('\n - ')}`); }
}

export interface Registry {
  items: readonly ItemContent[];
  combos: readonly ComboContent[];
  sets: readonly SetContent[];
  item(id: string): ItemContent | undefined;
  combo(id: string): ComboContent | undefined;
  set(id: string): SetContent | undefined;
}

/** Validates and indexes content files (sorted by path, so file order is stable). Throws `ContentError` on any problem. */
export function createRegistry(files: Partial<ContentFiles>, opts: ValidateOptions = {}): Registry {
  const problems = validateContent(files, opts);
  if (problems.length) throw new ContentError(problems);
  const sorted = <T>(o: Record<string, T> | undefined): T[] => Object.entries(o ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
  const items = sorted(files.items), combos = sorted(files.combos), sets = sorted(files.sets);
  const im = new Map(items.map((c) => [c.id as string, c])), cm = new Map(combos.map((c) => [c.id as string, c])), sm = new Map(sets.map((c) => [c.id as string, c]));
  return { items, combos, sets, item: (id) => im.get(id), combo: (id) => cm.get(id), set: (id) => sm.get(id) };
}

const FILES: ContentFiles = {
  items: import.meta.glob<ItemContent>('../content/items/*.ts', { eager: true, import: 'default' }),
  combos: import.meta.glob<ComboContent>('../content/combos/*.ts', { eager: true, import: 'default' }),
  sets: import.meta.glob<SetContent>('../content/sets/*.ts', { eager: true, import: 'default' }),
};

export const registry: Registry = createRegistry(FILES, { itemOrder: ITEM_ORDER, comboOrder: RECIPE_ORDER });

export const contentItem = (id: ItemTypeId): ItemContent | undefined => registry.item(id);
export const contentCombo = (id: RecipeId): ComboContent | undefined => registry.combo(id);
export const contentSet = (id: SetId): SetContent | undefined => registry.set(id);
export const contentItems = (): readonly ItemContent[] => registry.items;
export const contentCombos = (): readonly ComboContent[] => registry.combos;
export const contentSets = (): readonly SetContent[] => registry.sets;

/** A content set's tune resolved at `level` (0 reads like level 1: the base values). The one reader outside build/hooks: run.ts (interest), weapons.ts (puddles). */
export const contentSetTune = (id: SetId, level: number): Record<string, number> => resolveTune(registry.set(id)?.tune, level);

/** A content combo's tune (scalars: a combo has no tier). The one reader outside build/hooks: the pattern code that still drives a combo's shot or visual (weapons.ts). */
export const contentComboTune = (id: RecipeId): Record<string, number> => resolveTune(registry.combo(id)?.tune, 1);

/** A content item's tune resolved at `tier`. */
export const contentTune = (id: ItemTypeId, tier: number): Record<string, number> => resolveTune(registry.item(id)?.tune, tier);
