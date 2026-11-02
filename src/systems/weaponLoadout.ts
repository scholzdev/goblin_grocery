import { ITEMS } from '../data/items';
import { t } from '../i18n';
import type { Inventory, ItemInstance, ItemTypeId } from '../types';

export const MAX_WEAPON_TYPES = 2;
/** Duplicates are upgrade materials, and occupy the same type slot. Shelf weapons count too. */
export function ownedWeapons(inv: Inventory): ItemTypeId[] {
  return [...new Set([...inv.placed, ...inv.shelf].filter((i): i is ItemInstance => !!i && !!ITEMS[i.type].weapon).map((i) => i.type))];
}

export function weaponLoadoutIssue(inv: Inventory, adding?: ItemTypeId): string {
  if (adding && !ITEMS[adding].weapon) return '';
  const types = ownedWeapons(inv);
  if (adding && ITEMS[adding].weapon && !types.includes(adding)) types.push(adding);
  if (types.length > MAX_WEAPON_TYPES) return t('rWeaponLimit');
  if (new Set(types.map((id) => ITEMS[id].weaponFamily)).size < types.length) return t('rWeaponFamily');
  return '';
}

export const equippedWeaponIssue = (inv: Inventory): string =>
  inv.placed.filter((i) => !!ITEMS[i.type].weapon).length > MAX_WEAPON_TYPES ? t('rEquippedWeapons') : '';

/** A shelf-to-cart placement adds one equipped instance. Moves within the cart leave the count unchanged. */
export function weaponPlacementIssue(inv: Inventory, uid: string): string {
  const item = inv.shelf.find((i) => i?.uid === uid);
  return item && ITEMS[item.type].weapon && inv.placed.filter((i) => !!ITEMS[i.type].weapon).length >= MAX_WEAPON_TYPES ? t('rEquippedWeapons') : '';
}
