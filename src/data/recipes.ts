import type { ItemTypeId, RecipeDef, RecipeId } from '../types';
import { RECIPE_ORDER, type ComboContent } from '../engine/define';
import { contentCombo } from '../engine/registry';

/** What the matching code needs of a combo content file: the items it takes (weapon first, if any) and what it overrides. */
const recipeDefOf = (c: ComboContent): RecipeDef => {
  const def: RecipeDef = { id: c.id, supports: [...(c.cart ? c.requires : c.requires.slice(1))] };
  if (!c.cart) def.weapon = c.requires[0];
  if (c.replaces) def.replaces = [...c.replaces];
  if (c.suppresses) def.suppresses = [...c.suppresses];
  return def;
};

/** Every combo, in `RECIPE_ORDER` (engine/define), derived from its content file (src/content/combos/<id>.ts). Names and texts: `recipeT`. */
export const RECIPES: Record<RecipeId, RecipeDef> = Object.fromEntries(RECIPE_ORDER.map((id) => {
  const c = contentCombo(id);
  if (!c) throw new Error(`combo "${id}" has no content file (src/content/combos/${id}.ts)`);
  return [id, recipeDefOf(c)];
})) as Record<RecipeId, RecipeDef>;

/** Every item type a combo needs (weapon first, if any). Cart combos have no weapon. */
export const recipeParts = (r: RecipeDef): ItemTypeId[] => [...(r.weapon ? [r.weapon] : []), ...r.supports];
/** Item whose icon stands for the combo. */
export const recipeIcon = (r: RecipeDef): ItemTypeId => r.weapon ?? r.supports[0];
