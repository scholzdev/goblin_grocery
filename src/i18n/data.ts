import { contentLang, lang } from './lang';
import { t } from './index';
import { DATA_DE } from './data-de';
import { PLAYER } from '../data/items';
import { DEPARTMENTS } from '../data/departments';
import { ZONES, type ZoneId } from '../data/zones';
import { SHIFTS } from '../data/waves';
import { CART_SKINS, GOBLIN_SKINS, UNLOCKS } from '../data/unlocks';
import { enemyTextTune, hasStar3 } from '../engine/define';
import { contentCombo, contentEnemy, contentItem, contentSet } from '../engine/registry';
import { renderAll, renderText } from '../engine/text';
import type { CartSkin, GoblinSkin } from '../data/unlocks';
import type { DepartmentId, EnemyId, ItemTypeId, RecipeId, SetId, StarterId } from '../types';

const de = () => lang() === 'de';
// Gameplay content currently has English and German records. Chinese uses the
// complete English catalog until translated records are added.

/** An item's name and blurb in the current language (the blurb's placeholders filled at ★1). */
export const itemT = (id: ItemTypeId) => {
  const c = contentItem(id)!, { name, blurb } = c.text[contentLang()];
  return { name, blurb: renderText(blurb, c.tune, 1, contentLang()) };
};
export const itemRules = (id: ItemTypeId, tier = 1): string => {
  const c = contentItem(id)!, t = c.text[contentLang()];
  const rules = renderText(t.rules, c.tune, tier, contentLang());
  return hasStar3(tier) && t.star3 ? `${rules} ${renderText(t.star3, c.tune, tier, contentLang())}` : rules;
};
/** Below ★3, a weapon's ★3 line as a teaser ("At ★3: …", numbers at ★3); '' from ★3 on and for items without one. */
export const star3Teaser = (id: ItemTypeId, tier = 1): string => {
  const c = contentItem(id)!, line = c.text[contentLang()].star3;
  return line && !hasStar3(tier) ? t('star3At', { line: renderText(line, c.tune, 3, contentLang()).replace(/^★3:\s*/, '') }) : '';
};
/** A combo's name and texts in the current language, the placeholders filled from its tune. */
export const recipeT = (id: RecipeId) => {
  const c = contentCombo(id)!;
  return renderAll(c.text[contentLang()], c.tune, contentLang());
};
/** An enemy's name and codex blurb in the current language (the blurb's placeholders filled from its tune and stats). */
export const enemyT = (id: EnemyId) => {
  const c = contentEnemy(id)!, { name, blurb } = c.text[contentLang()];
  return { name, blurb: renderText(blurb, enemyTextTune(c), 1, contentLang()) };
};
export const deptT = (id: DepartmentId) => {
  const { name, short, blurb, enemiesText, rewardText } = de() ? DATA_DE.departments[id] : DEPARTMENTS[id];
  return { name, short, blurb, enemiesText, rewardText };
};
export const zoneT = (id: ZoneId) => {
  const { name, blurb } = de() ? DATA_DE.zones[id] : ZONES[id];
  return { name, blurb };
};
export const shiftT = (i: number) => {
  const { name, blurb } = (de() ? DATA_DE.shifts : SHIFTS)[i];
  return { name, blurb };
};
export const starterT = (id: StarterId) => {
  const { name, blurb } = de() ? DATA_DE.starters[id] : PLAYER.starters[id];
  return { name, blurb };
};
export const goblinSkinT = (id: GoblinSkin) => (de() ? DATA_DE.goblinSkins[id] : GOBLIN_SKINS[id]);
export const cartSkinT = (id: CartSkin) => (de() ? DATA_DE.cartSkins[id] : CART_SKINS[id]);
export const unlockNeedT = (id: string): string =>
  de() ? DATA_DE.unlocks[id] : UNLOCKS.find((u) => u.id === id)?.need ?? '';
/** A tag's display name. Set ids (family, element, electric) come from their content file; weapon tags (ranged ...) from the DE table. */
export const tagT = (tag: string): string => {
  const set = contentSet(tag as SetId);
  if (set) return set.text[contentLang()].name;
  return de() ? DATA_DE.tags[tag] ?? tag : tag.charAt(0).toUpperCase() + tag.slice(1);
};
/** The bonus line of set level `lv`, rendered from the set's tune at that level (arrays are L1/L2/L3). */
export const setBonusT = (id: SetId, lv: 1 | 2 | 3): string => {
  const c = contentSet(id)!;
  return renderText(c.text[contentLang()].bonus[lv - 1], c.tune, lv, contentLang());
};
