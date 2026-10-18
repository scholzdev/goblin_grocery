import { DAMAGE_TYPES, ELEMENT_COLORS, type DamageType } from '../engine/damageType';
import { totalDamage } from '../systems/damageStats';
import { REACTION_IDS } from '../engine/define';

import { t, fmtNum, type UIKey } from '../i18n';
import type { Inventory, RunStats } from '../types';
import { damageTypeName } from './affinity';
import { itemT } from '../i18n/data';
import { weaponTags } from '../engine/hitTags';
import { REACTION_LABEL, REACTION_TEXT } from '../engine/reactions';

// The run-end "damage breakdown" (docs/item-hooks-refactor.md "Damage breakdown"): per-source bars, the damage by type as one stacked bar with a legend,
// the DoT / weak / resisted shares, the Shred and mark bonuses and the reaction counts. The colors come from `ELEMENT_COLORS` unless the "Damage colors" setting is off.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (v: number, total: number): string => `${Math.round((v / total) * 100)}%`;
/** Sources shown as bars; the rest are summed into "+N more". */
const BARS = 4;

export interface BreakdownNames {
  /** The label of a `damageByWeapon` key (an item, burn, poison, a label ...). */
  name: (key: string) => string;
  /** The type its bar is colored by (an item's first element, burn heat, poison poison, else physical). */
  type: (key: string) => DamageType;
}

/** The breakdown block of the run-end receipt, '' when the run dealt no damage. */
export function damageBreakdownHtml(stats: Pick<RunStats, 'damageByWeapon' | 'damage'>, names: BreakdownNames, colors: boolean): string {
  const d = stats.damage, total = totalDamage(d);
  if (!(total > 0)) return '';
  const src = Object.entries(stats.damageByWeapon).sort((a, b) => b[1] - a[1]);
  const bars = src.slice(0, BARS).map(([k, v]) => {
    const fill = colors ? ELEMENT_COLORS[names.type(k)] : 'var(--plum-soft)';
    return `<div class="dbar"><span class="dn">${esc(names.name(k))}</span><span class="dtrack"><i style="width:${Math.max(2, (v / total) * 100)}%;background:${fill}"></i></span><span class="dv">${fmtNum(Math.round(v))}<small>${pct(v, total)}</small></span></div>`;
  }).join('');
  const more = src.length > BARS ? `<div class="dmore">${t('moreN', { n: src.length - BARS })}</div>` : '';
  const types = DAMAGE_TYPES.filter((ty) => d.byType[ty] > 0).sort((a, b) => d.byType[b] - d.byType[a]);
  const stack = colors ? `<div class="dstack">${types.map((ty) => `<i style="flex:${d.byType[ty]};background:${ELEMENT_COLORS[ty]}" title="${esc(damageTypeName(ty))}"></i>`).join('')}</div>` : '';
  const legend = types.map((ty) => `<span class="dleg">${colors ? `<i style="background:${ELEMENT_COLORS[ty]}"></i>` : ''}${esc(damageTypeName(ty))} <b>${pct(d.byType[ty], total)}</b></span>`).join('');
  const reacted = REACTION_IDS.filter((r) => d.reactions[r] > 0);
  const line = (label: string, v: string) => `<div class="line"><span>${label}</span><span>${v}</span></div>`;
  const lines = [
    d.dot > 0 && line(t('dmgShareDot'), pct(d.dot, total)),
    d.weak > 0 && line(t('dmgShareWeak'), pct(d.weak, total)),
    d.resisted > 0 && line(t('dmgShareResisted'), pct(d.resisted, total)),
    d.shred >= 0.5 && line(t('dmgBonusShred'), `+${fmtNum(Math.round(d.shred))}`),
    d.mark >= 0.5 && line(t('dmgBonusMark'), `+${fmtNum(Math.round(d.mark))}`),
    reacted.length > 0 && line(t('dmgReactions'), `${reacted.map((r) => `${t(REACTION_TEXT[r].name)} \u00d7${d.reactions[r]}`).join(', ')}${d.byType.reaction >= 0.5 ? ` \u00b7 ${fmtNum(Math.round(d.byType.reaction))}` : ''}`),
  ].filter(Boolean).join('');
  return `<hr class="dash"><div class="dmg">
    <div class="dh">${t('damageByItem')}</div>${bars}${more}
    <div class="dh">${t('damageByType')}</div>${stack}<div class="dlegend">${legend}</div>
    ${lines ? `<div class="dlines">${lines}</div>` : ''}
  </div>`;
}

const DMG_LABELS: Record<string, UIKey> = { burn: 'dmgBurn', poison: 'dmgPoison', 'Bag It': 'dmgBag', 'Tin Foil Hat': 'dmgFoil', Slam: 'dmgSlam', shove: 'dmgShove', 'Slam Bumper': 'dmgBumper', 'Can Pyramid': 'dmgBowl', 'Oven vent': 'dmgVent', 'Live cable': 'dmgCable', 'Party Popper': 'dmgPopper', 'Egg Carton': 'dmgEgg', [REACTION_LABEL.shatter]: REACTION_TEXT.shatter.name, [REACTION_LABEL.conduct]: REACTION_TEXT.conduct.name, [REACTION_LABEL.crack]: REACTION_TEXT.crack.name };
const REACTION_KEYS: readonly string[] = Object.values(REACTION_LABEL);

/** Names and bar colors for the sources of a run (items of `inv`, burn, poison, reactions, the labels): shared by the run-end receipt and the lab meter. */
export function sourceNames(inv: Inventory): BreakdownNames {
  const itemOf = (k: string) => inv.placed.find((i) => i.uid === k) ?? inv.shelf.find((i) => i?.uid === k);
  return {
    name: (k) => { const it = itemOf(k); return it ? itemT(it.type).name : t(DMG_LABELS[k] ?? 'dmgSold'); },
    type: (k) => { const it = itemOf(k), tag = it && weaponTags(it.type)[0]; return tag && tag !== 'mark' ? tag : k === 'burn' ? 'heat' : k === 'poison' ? 'poison' : REACTION_KEYS.includes(k) ? 'reaction' : 'physical'; },
  };
}
