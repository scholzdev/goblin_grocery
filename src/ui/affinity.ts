import type { AffinityTag } from '../engine/define';
import type { EnemyId, ItemTypeId } from '../types';
import { ENEMIES, enemiesWeakTo, enemyFrame, isBossId } from '../data/enemies';
import { ITEMS } from '../data/items';
import { itemTags } from '../engine/hitTags';
import { ELEMENT_COLORS, type DamageType } from '../engine/damageType';
import { t } from '../i18n';
import { enemyT, tagT } from '../i18n/data';
import { setIcon } from './icons';
import { svg } from './hud';

// The element soft counters on screen (docs/item-hooks-refactor.md "Affinity"): the codex's weak / resist chips and the shop card's "Strong vs" strip.
// Everything is derived from the enemy files (`weak`, `resist`, `armor`) and the item's sets and `shreds` flag; no per-enemy or per-item text.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A tag's display name: the five element sets come from their set file (Heat, Frost, Blast, Electric, Cleaning), poison and marks from the UI table. */
export const affinityName = (tag: AffinityTag): string => (tag === 'poison' ? t('affPoison') : tag === 'mark' ? t('affMark') : tagT(tag));

/** A damage type's display name: the tag names plus Physical (no tag) and the reserved Reaction. */
export const damageTypeName = (type: DamageType): string => (type === 'physical' ? t('dmgPhysical') : type === 'reaction' ? t('dmgReaction') : affinityName(type));

/**
 * A tag as a small chip with its set icon, in the element's damage color (`ELEMENT_COLORS`, the same hue as the damage numbers; the `set-` / `aff-`
 * class keeps the shop's set chip look as the base, `aff-el` retints it from `--ec`). Marks keep their gold chip.
 */
export const affinityChip = (tag: AffinityTag): string =>
  `<span class="chip ${tag === 'poison' || tag === 'mark' ? `aff-${tag}` : `set-${tag}`}${tag === 'mark' ? '' : ' aff-el'}" style="--ec:${ELEMENT_COLORS[tag]}">${setIcon(tag, 12)}${esc(affinityName(tag))}</span>`;

/** The armor chip of the codex: a shield and the armor number (Canned Beans). */
export const armorChip = (armor: number): string => `<span class="chip aff-armor">${setIcon('armor', 12)}${armor}</span>`;

/** The codex rows of an enemy: "Weak to: ...", "Resists: ..." and "Armor: [shield] 3" (empty when it has none of them, e.g. the Melon Slice). */
export function affinityRowsHtml(id: EnemyId): string {
  const d = ENEMIES[id];
  const row = (cls: string, label: string, m: Partial<Record<AffinityTag, number>> | undefined) => {
    const tags = Object.keys(m ?? {}) as AffinityTag[];
    return tags.length ? `<div class="aff-row ${cls}"><b>${esc(label)}</b>${tags.map(affinityChip).join('')}</div>` : '';
  };
  const armor = d.armor ? `<div class="aff-row armor"><b>${esc(t('armorLabel'))}</b>${armorChip(d.armor)}</div>` : '';
  return row('weak', t('weakTo'), d.weak) + row('resist', t('resistsLabel'), d.resist) + armor;
}

/**
 * The shop card strip "Strong vs: [icons] [Armored]" of a weapon or module: the enemies weak to its elements (`itemTags`), groceries first, bosses ringed,
 * then the "Armored" chip of an item that shreds armor (`shreds`). '' for none (passives, element-less modules).
 */
export function strongVsHtml(type: ItemTypeId): string {
  const ids = enemiesWeakTo(itemTags(type)), shreds = !!ITEMS[type].shreds;
  if (!ids.length && !shreds) return '';
  const imgs = ids.map((id) => { const n = esc(enemyT(id).name); return `<img class="${isBossId(id) ? 'boss' : ''}" src="${svg(enemyFrame(id))}" alt="${n}" title="${n}">`; }).join('');
  const armored = shreds ? `<span class="chip aff-armor">${setIcon('armor', 12)}${esc(t('affArmored'))}</span>` : '';
  return `<div class="strongvs"><b>${esc(t('strongVs'))}</b>${imgs}${armored}</div>`;
}
