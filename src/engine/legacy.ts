import type { ItemDef, RecipeDef } from '../types';
import { resolveShape, type ComboContent, type ItemContent, type Lang } from './define';
import { legacyRules, renderAll } from './text';

// Conversions from content files to the legacy table entries (ItemDef, RecipeDef, DATA_DE rows), so code
// outside the engine keeps reading ITEMS / RECIPES / DATA_DE until phase 8 deletes them.

/** The legacy `ItemDef`. `rules` is in the legacy `{0}`/`{1}` form (indices into the scaling rows), see `legacyRules`. */
export function itemDefOf(c: ItemContent): ItemDef {
  const def: ItemDef = {
    id: c.id, family: c.sets[0], name: c.text.en.name, kind: c.kind,
    cells: resolveShape(typeof c.shape === 'function' ? c.shape(1) : c.shape), price: c.price, electrical: !!c.electrical,
    blurb: c.text.en.blurb, rules: legacyRules(c.text.en.rules, c, 'en'),
  };
  if (c.sets[1]) def.element = c.sets[1];
  if (c.tags) def.tags = [...c.tags];
  if (c.weapon) def.weapon = c.weapon;
  if (c.legendary) def.legendary = true;
  if (c.buff) def.buff = c.buff;
  if (c.flavored) def.flavored = true;
  return def;
}

/** One language's row of `DATA_DE.items` (the legacy form again). */
export const itemTextOf = (c: ItemContent, lang: Lang): { name: string; blurb: string; rules: string } => {
  const t = c.text[lang];
  return { name: t.name, blurb: t.blurb, rules: legacyRules(t.rules, c, lang) };
};

/** The legacy `RecipeDef` (text rendered in English: combos have scalar tune, so there is nothing tier-dependent). */
export function recipeDefOf(c: ComboContent): RecipeDef {
  const def: RecipeDef = { id: c.id, supports: [...(c.cart ? c.requires : c.requires.slice(1))], ...renderAll(c.text.en, c.tune, 'en') };
  if (!c.cart) def.weapon = c.requires[0];
  if (c.replaces) def.replaces = [...c.replaces];
  return def;
}

/** A combo's rendered text in one language (`recipeT` and `DATA_DE.recipes`). */
export const recipeTextOf = (c: ComboContent, lang: Lang): { name: string; short: string; summary: string; detail: string } => renderAll(c.text[lang], c.tune, lang);
