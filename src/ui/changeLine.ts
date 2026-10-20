import { fmtNum, t } from '../i18n';
import { itemT, recipeT, tagT } from '../i18n/data';
import type { Build, SetId } from '../types';

/**
 * What a cart edit changed, from the builds before and after it: weapon damage and interval, combos formed or lost, and set levels while
 * sets are shown. Numbers are compared as displayed, so float noise never makes a line. '' when nothing changed.
 */
export function changeLine(before: Build, after: Build, sets: boolean): string {
  const out: string[] = [];
  const dmg = (n: number) => fmtNum(+n.toFixed(1)), cd = (n: number) => fmtNum(n.toFixed(2));
  for (const w of after.weapons) {
    const b = before.weapons.find((x) => x.uid === w.uid);
    if (!b) continue;
    const parts = [
      ...(dmg(b.damage) !== dmg(w.damage) ? [t('chgDamage', { a: dmg(b.damage), b: dmg(w.damage) })] : []),
      ...(cd(b.cooldown) !== cd(w.cooldown) ? [t('chgCooldown', { a: cd(b.cooldown), b: cd(w.cooldown) })] : []),
    ];
    if (parts.length) out.push(`${itemT(w.type).name}: ${parts.join(', ')}`);
  }
  const was = new Set(before.recipes.map((r) => r.id)), now = new Set(after.recipes.map((r) => r.id));
  for (const id of now) if (!was.has(id)) out.push(t('chgComboOn', { name: recipeT(id).name }));
  for (const id of was) if (!now.has(id)) out.push(t('chgComboOff', { name: recipeT(id).name }));
  if (sets) for (const id of Object.keys(after.sets) as SetId[]) if (after.sets[id] !== before.sets[id]) out.push(t('chgSet', { set: tagT(id), a: before.sets[id], b: after.sets[id] }));
  return out.join(' · ');
}
