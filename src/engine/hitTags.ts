import { setsOf } from '../data/sets';
import type { ItemTypeId } from '../types';
import { HIT_TAGS } from './affinity';
import type { AffinityTag } from './define';
import type { HitOpts } from './hooks';

// The tags of one hit (docs/item-hooks-refactor.md "Affinity"). Two sources, merged:
//   the weapon   the source weapon's element sets (heat, frost, blast), its family when that is `cleaning`, and `electric` for an electrical weapon
//                (exactly the weapon's `setsOf` that is also a hit tag; a weapon-less hit has none);
//   the kind     what the hit IS, whatever fired it: a burn tick is heat, a poison tick poison, an Electric-set arc (`chained`) electric, a Party Popper /
//                Blast-set pop (`fromPopper`) blast, and a call site can add more through `opts.tags` (explosions blast, the Leaf Blower slam cleaning ...).
// Pure and cheap: a weapon-only hit returns the cached array of its item type.

const NONE: readonly AffinityTag[] = Object.freeze([]);
const cache = new Map<ItemTypeId, readonly AffinityTag[]>();

/** The hit tags a weapon item type carries on every hit. */
export function weaponTags(type: ItemTypeId): readonly AffinityTag[] {
  const hit = cache.get(type);
  if (hit) return hit;
  const tags: readonly AffinityTag[] = Object.freeze(HIT_TAGS.filter((tag) => (setsOf(type) as readonly string[]).includes(tag)));
  cache.set(type, tags);
  return tags;
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
