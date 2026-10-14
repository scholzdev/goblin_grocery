import { lang } from './lang';
import { DATA_DE } from './data-de';
import { ITEMS, PLAYER } from '../data/items';
import { RECIPES } from '../data/recipes';
import { ENEMIES } from '../data/enemies';
import { DEPARTMENTS } from '../data/departments';
import { SHIFTS } from '../data/waves';
import { CART_SKINS, GOBLIN_SKINS, UNLOCKS } from '../data/unlocks';
import type { CartSkin, GoblinSkin } from '../data/unlocks';
import type { DepartmentId, EnemyId, ItemTypeId, RecipeId, StarterId } from '../types';

const de = () => lang() === 'de';

export const itemT = (id: ItemTypeId) => {
  const { name, blurb, rules } = de() ? DATA_DE.items[id] : ITEMS[id];
  return { name, blurb, rules };
};
export const recipeT = (id: RecipeId) => {
  const { name, short, summary, detail } = de() ? DATA_DE.recipes[id] : RECIPES[id];
  return { name, short, summary, detail };
};
export const enemyT = (id: EnemyId) => {
  const { name, blurb } = de() ? DATA_DE.enemies[id] : ENEMIES[id];
  return { name, blurb };
};
export const deptT = (id: DepartmentId) => {
  const { name, short, blurb, enemiesText, rewardText } = de() ? DATA_DE.departments[id] : DEPARTMENTS[id];
  return { name, short, blurb, enemiesText, rewardText };
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
export const tagT = (tag: string): string => (de() ? DATA_DE.tags[tag] ?? tag : tag);
