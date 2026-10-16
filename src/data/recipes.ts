import type { ItemTypeId, RecipeDef, RecipeId } from '../types';
import { recipeDefOf } from '../engine/legacy';
import { assertRegistry, contentCombo } from '../engine/registry';
import { ITEM_IDS } from './items';

/**
 * Order of `RECIPES` (computeBuild applies the matching combos in this order, so it decides which combo hook runs first on a weapon).
 * The combos themselves are content files, src/content/combos/<id>.ts; a new combo is added here and to the `RecipeId` union.
 */
export const RECIPE_ORDER: RecipeId[] = [
  'toastMode', 'nailstorm', 'coldStorage', 'expressCheckout', 'brainFreeze', 'tvDinner', 'clearanceSale', 'greaseFire', 'pressurePoint', 'mistMachine',
  'fiveAlarm', 'sizzlingSkillet', 'chickenDinner', 'frostbiteNails', 'staticCling', 'reheat', 'smoothieShield', 'confettiCannon', 'blackIce', 'shrapnel',
  'pressureWasher', 'powerSurge', 'potSlam', 'priceCheck', 'sugarRush', 'smashBank', 'bagIt', 'sourMist', 'sparksFly', 'rayGun', 'tailwind',
];

/** Every combo, in `RECIPE_ORDER`, as the legacy `RecipeDef` (converted from its content file; the rest of the game still reads this shape). */
export const RECIPES: Record<RecipeId, RecipeDef> = Object.fromEntries(RECIPE_ORDER.map((id) => {
  const c = contentCombo(id);
  if (!c) throw new Error(`combo "${id}" has no content file (src/content/combos/${id}.ts)`);
  return [id, recipeDefOf(c)];
})) as Record<RecipeId, RecipeDef>;

// Content that points at ids outside content (a combo's `requires`, `replaces`) must resolve against the legacy item table and this order.
assertRegistry({ knownItemIds: ITEM_IDS, knownComboIds: RECIPE_ORDER });

/** Every item type a combo needs (weapon first, if any). Cart combos have no weapon. */
export const recipeParts = (r: RecipeDef): ItemTypeId[] => [...(r.weapon ? [r.weapon] : []), ...r.supports];
/** Item whose icon stands for the combo. */
export const recipeIcon = (r: RecipeDef): ItemTypeId => r.weapon ?? r.supports[0];
