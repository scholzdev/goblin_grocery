import type { AffinityTag } from '../engine/define';
import type { EnemyId, ItemTypeId } from '../types';
import { ENEMIES, enemiesWeakTo, enemyFrame, isBossId } from '../data/enemies';
import { itemTags } from '../engine/hitTags';
import { t } from '../i18n';
import { enemyT, tagT } from '../i18n/data';
import { setIcon } from './icons';
import { svg } from './hud';

// The element soft counters on screen (docs/item-hooks-refactor.md "Affinity"): the codex's weak / resist chips and the shop card's "Strong vs" strip.
// Everything is derived from the enemy files (`weak`, `resist`) and the item's sets; no per-enemy or per-item text.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A tag's display name: the five element sets come from their set file (Heat, Frost, Blast, Electric, Cleaning), poison and marks from the UI table. */
export const affinityName = (tag: AffinityTag): string => (tag === 'poison' ? t('affPoison') : tag === 'mark' ? t('affMark') : tagT(tag));

/** A tag as a small chip with its set icon and colour (the set chips of the shop; poison and marks have their own). */
export const affinityChip = (tag: AffinityTag): string =>
  `<span class="chip ${tag === 'poison' || tag === 'mark' ? `aff-${tag}` : `set-${tag}`}">${setIcon(tag, 12)}${esc(affinityName(tag))}</span>`;

/** The codex rows of an enemy: "Weak to: ..." and "Resists: ..." (empty when it has neither, e.g. the Melon Slice). */
export function affinityRowsHtml(id: EnemyId): string {
  const d = ENEMIES[id];
  const row = (cls: string, label: string, m: Partial<Record<AffinityTag, number>> | undefined) => {
    const tags = Object.keys(m ?? {}) as AffinityTag[];
    return tags.length ? `<div class="aff-row ${cls}"><b>${esc(label)}</b>${tags.map(affinityChip).join('')}</div>` : '';
  };
  return row('weak', t('weakTo'), d.weak) + row('resist', t('resistsLabel'), d.resist);
}

/** The shop card strip "Strong vs: [icons]" of a weapon or module: the enemies weak to its elements (`itemTags`), groceries first, bosses ringed. '' for none (passives, element-less modules). */
export function strongVsHtml(type: ItemTypeId): string {
  const ids = enemiesWeakTo(itemTags(type));
  if (!ids.length) return '';
  const imgs = ids.map((id) => { const n = esc(enemyT(id).name); return `<img class="${isBossId(id) ? 'boss' : ''}" src="${svg(enemyFrame(id))}" alt="${n}" title="${n}">`; }).join('');
  return `<div class="strongvs"><b>${esc(t('strongVs'))}</b>${imgs}</div>`;
}
