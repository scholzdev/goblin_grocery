import { ITEMS } from '../data/items';
import type { ItemTypeId } from '../types';
import { HIT_TAGS } from './affinity';
import type { AffinityTag } from './define';
import type { HitOpts } from './hooks';

// The tags of one hit (docs/item-hooks-refactor.md "Affinity"). Two sources, merged:
//   the item     the tags of its declared sets: its element (`heat`, `frost`, `blast`) and `cleaning` when its family is Cleaning, plus the extra
//                `elements` its file declares (Laser and Blender: `electric`). The `electrical` flag does NOT add `electric` (it only makes the
//                item count toward the Electric set), so Toaster, Microwave, Nail Gun and Vacuum are not electric;
//   the kind     what the hit IS, whatever fired it: a burn tick is heat, a poison tick poison, an Electric-set arc or Ray Gun splash (`chained`) electric,
//                a Party Popper / Blast-set pop (`fromPopper`) blast, and a call site can add more through `opts.tags` (explosions blast, the Leaf
//                Blower slam cleaning, the live cable electric ...).
// Pure and cheap: a weapon-only hit returns the cached array of its item type.

const NONE: readonly AffinityTag[] = Object.freeze([]);
const cache = new Map<ItemTypeId, readonly AffinityTag[]>();

/** The hit tags a weapon item type carries on every hit: its declared element, the Cleaning family and its declared `elements`. */
export function weaponTags(type: ItemTypeId): readonly AffinityTag[] {
  const hit = cache.get(type);
  if (hit) return hit;
  const d = ITEMS[type];
  const declared = [d.family, d.element, ...(d.elements ?? [])] as readonly (string | undefined)[];
  const tags: readonly AffinityTag[] = Object.freeze(HIT_TAGS.filter((tag) => declared.includes(tag)));
  cache.set(type, tags);
  return tags;
}

/**
 * The elements a shop item is strong with, for the card's "Strong vs": a weapon's hit tags (its sets plus its `elements`), or what a module's
 * effect deals (`elements`, declared in its file). Passives have none.
 */
export function itemTags(type: ItemTypeId): readonly AffinityTag[] {
  const d = ITEMS[type];
  return d.kind === 'weapon' ? weaponTags(type) : d.kind === 'module' ? d.elements ?? NONE : NONE;
}

/** The tags of a hit by `stats` (its weapon) with these `opts` (its kind). */
export function hitTags(stats: { type: ItemTypeId } | null, o: HitOpts): readonly AffinityTag[] {
  const base = stats ? weaponTags(stats.type) : NONE;
  if (!o.isDot && !o.chained && !o.fromPopper && !o.tags) return base;
  let out: AffinityTag[] | null = null;
  const add = (tag: AffinityTag) => { if (!base.includes(tag) && !out?.includes(tag)) (out ??= [...base]).push(tag); };
  if (o.poison) add('poison');
  else if (o.isDot) add('heat');
  if (o.chained) add('electric');
  if (o.fromPopper) add('blast');
  if (o.tags) for (const tag of o.tags) add(tag);
  return out ?? base;
}
