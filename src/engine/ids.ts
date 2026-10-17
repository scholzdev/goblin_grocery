import { AFFINITY_TAGS, BUFF_ORDER, ENEMY_ORDER, ITEM_ORDER, RECIPE_ORDER, SET_ORDER } from './define';

// Typed id constants: `Item.pan` is the string 'pan', typed as the literal `'pan'`. Content files and sims write ids through these instead of
// bare strings, so a typo is a compile error at the use site, "find usages" and rename work, and `tests/content/ids-lint.test.ts` fails
// when a bare id slips back in. The values are derived from the order lists of define.ts (the single place an id is added), so a new
// item/combo/enemy needs no edit here.
//
// This module is a LEAF next to define.ts: it imports nothing but define.ts, never data/* or the registry (content imports it at load time).
//
// Naming: `Item`, `Combo`, `Enemy`, `Set`, `Buff`, `Tag`.
//   - `Set` shadows the global `Set` in any file that imports it. A file that also needs `new Set(...)` imports it under an alias:
//     `import { Set as S } from '../../engine/ids'` (src/content/sets/electric.ts, src/content/items/multipack.ts).
//   - `Item` and `Buff` share ids ('fan' is both the Desk Fan item and its module buff): pick the namespace of what the field holds
//     (`requires: [Item.fan]`, `buff: Buff.fan`). `Set` and `Tag` share heat/frost/blast/cleaning the same way (`sets: [Set.kitchen, Set.heat]`, `tags: [Tag.heat]`).

/** A frozen `{ [id]: id }` object whose property types are the literal ids. */
export const idEnum = <const T extends readonly string[]>(ids: T): Readonly<{ [K in T[number]]: K }> =>
  Object.freeze(Object.fromEntries(ids.map((id) => [id, id]))) as { [K in T[number]]: K };

/** Every item type: `Item.pan`. */
export const Item = idEnum(ITEM_ORDER);
/** Every combo (recipe): `Combo.potSlam`. */
export const Combo = idEnum(RECIPE_ORDER);
/** Every enemy, bosses included: `Enemy.milk`, `Enemy.boss_frozen`. */
export const Enemy = idEnum(ENEMY_ORDER);
/** Every set: the five families, the elements heat / frost / blast and 'electric': `Set.kitchen`. */
export const Set = idEnum(SET_ORDER);
/** Every module buff: `Buff.fan`. */
export const Buff = idEnum(BUFF_ORDER);
/** Every affinity / hit tag (heat, frost, electric, blast, cleaning, poison, mark): `Tag.heat`. Also the element of a Jelly Beans flavor. */
export const Tag = idEnum(AFFINITY_TAGS);
