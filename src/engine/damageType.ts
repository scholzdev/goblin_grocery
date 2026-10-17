import { weakTag, type AffinityDef } from './affinity';
import type { AffinityTag } from './define';

// Damage colors (docs/item-hooks-refactor.md "Damage colors"). One palette for everything that shows a damage type: the arena's damage numbers, the codex
// weak / resist chips, the shop's "Strong vs" strip and the run-end breakdown. Pure, no Phaser.

/**
 * What a hit is shown as: one of the hit tags (`engine/hitTags`), `physical` for a hit with none, and `reaction`, reserved for a future element-reaction
 * system (nothing produces it yet: `damageType` returns it only when asked, so its breakdown bucket stays 0).
 */
export type DamageType = Exclude<AffinityTag, 'mark'> | 'physical' | 'reaction';

/** Every damage type, in the order the breakdown lists them. */
export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'heat', 'frost', 'electric', 'poison', 'blast', 'cleaning', 'reaction'];

/**
 * The palette (hex, readable with the number's dark outline on every aisle floor). `mark` is no damage type but a weak tag (the boss "WEAK!" flash), so it
 * has an entry too: Price Check gold. Cleaning is lilac, clearly apart from the icy frost blue.
 */
export const ELEMENT_COLORS: Readonly<Record<AffinityTag | 'physical' | 'reaction', string>> = {
  physical: '#FFFFFF',
  heat: '#FF8A2B',
  frost: '#7FD6FF',
  electric: '#FFE64D',
  poison: '#8FCB57',
  blast: '#FF4D4D',
  cleaning: '#C792FF',
  reaction: '#3FE0C5',
  mark: '#F5BD45',
};

/** A palette color as the number Phaser tints take (`0xRRGGBB`). */
export const colorNum = (hex: string): number => parseInt(hex.slice(1), 16);

/** `hex` mixed `k` (0..1) of the way to white: the "brighter" of a weak hit. */
export function brighten(hex: string, k: number): string {
  const n = colorNum(hex), mix = (c: number) => Math.round(c + (255 - c) * k);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The kind of a hit the type can depend on (the `HitOpts` fields). */
export interface DamageTypeOpts {
  isDot?: boolean;
  poison?: boolean;
  /** Reserved: a hit made by an element reaction is shown as `reaction` before anything else. Nothing sets it yet. */
  reaction?: boolean;
}

/**
 * The type a hit is displayed (colored, and counted in the breakdown) as, by priority:
 *   reaction > a tag the enemy is weak to > the tick tag of a DoT (burn heat, poison poison) > the first weapon / item tag > physical.
 * `tags` are the hit's `hitTags`. Display only: damage itself is `affinityMult`, which takes the best weak and resist of all tags.
 */
export function damageType(tags: readonly AffinityTag[], def: AffinityDef, o: DamageTypeOpts = {}): DamageType {
  if (o.reaction) return 'reaction';
  const weak = tags.length ? weakTag(def, tags) : null;
  if (weak && weak !== 'mark') return weak;
  if (o.isDot) return o.poison ? 'poison' : 'heat';
  for (const tag of tags) if (tag !== 'mark') return tag;
  return 'physical';
}

/** How one damage number looks. `crit` asks the scene for the bold outline (a crit never gets its own color). */
export interface NumberStyle { color: string; size: number; alpha: number; crit: boolean }

export interface NumberStyleIn {
  type: DamageType;
  crit: boolean;
  isDot: boolean;
  poison: boolean;
  /** The weak / resisted tag of the hit (`weakTag` / `resistTag`), null for a neutral hit. */
  weak: AffinityTag | null;
  resisted: AffinityTag | null;
}

/**
 * The damage number style. With `colors` on: the type color; a weak hit a size up and brighter, a resisted one a size down at half alpha (its color
 * stays readable), a crit larger with the bold outline, a DoT tick smaller. With `colors` off (the "Damage colors" setting): the neutral scheme the game
 * had before, where only weak hits are tinted and a crit is coral.
 */
export function numberStyle(i: NumberStyleIn, colors: boolean): NumberStyle {
  const { crit, weak, resisted } = i, dot = i.isDot;
  if (!colors) {
    const color = crit ? '#F45F52' : weak ? ELEMENT_COLORS[weak] : resisted ? '#9C93B0' : i.poison ? '#8FCB57' : dot ? '#F5BD45' : '#FFF2D5';
    return { color, size: crit ? 28 : weak ? (dot ? 18 : 25) : resisted ? (dot ? 14 : 19) : dot ? 16 : 22, alpha: 1, crit: false };
  }
  const base = ELEMENT_COLORS[i.type];
  return {
    color: weak ? brighten(base, 0.3) : base,
    size: crit ? 30 : weak ? (dot ? 18 : 26) : resisted ? (dot ? 13 : 18) : dot ? 16 : 22,
    alpha: resisted ? 0.5 : 1,
    crit,
  };
}
