# Golden snapshots

These tests lock today's item/combo/set behavior and text byte-for-byte, so the item-hooks refactor
(`docs/item-hooks-refactor.md`) can prove it changed nothing.

| Test | Snapshot | Locks |
|---|---|---|
| `build.golden.test.ts` | `__snapshots__/build.json` | Full `computeBuild` output (weapons, recipes, adjacency, set levels, player stats) for ~340 fixed carts: every weapon at ★1-3, every buff module on every weapon, every other item at ★1/★3, all 31 combos with exactly their parts, every set at L1-L3, and edge cases (Gold Star, Jelly Beans flavors, Sourdough, Power Strip, Ray Gun/Nailstorm, Mist Machine, Cold Storage, Multipack + Toast Mode, Expired Milk max HP, legendaries, double packs, perks). |
| `text.golden.test.ts` | `__snapshots__/text.json` | EN + DE: item name/blurb/rules template, rules rendered at ★1/★2/★3 (`itemRules`), tier-scaling rows (`tierScaling`), combo name/short/summary/detail (`recipeT`), set name + L1/L2/L3 bonus text (`setBonus` in `src/ui/shop.ts`), and `describeBuffs` lines for every golden cart. |

Cart definitions live in `carts.ts` (deterministic placement, explicit flavors, uids `u0..`), the serializer in `serialize.ts`
(sorted keys, Sets/Maps as sorted arrays, floats rounded to 6 decimals, functions dropped). There is no RNG or clock in either path.

## During the refactor

A diff in either snapshot means behavior or text **changed**. It is not noise: every diff must be explained and justified
(for example one of the planned text/number fixes in §1 of the plan). Do not regenerate to make a test green.
Keep `carts.ts` stable while migrating, so the same inputs hit the new engine.

## Updating intentionally

```
npx vitest run -u tests/golden
git diff tests/golden/__snapshots__   # review every changed key, keyed per cart / item / combo
```

Commit the snapshot change together with the source change that caused it, and say why in the commit message.
