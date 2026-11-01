# Unit run-stock: per-run stock, owned-item weight, shop-1 pick

Background: `docs/audit/mechanics.md` (main checkout), sections "Unlocks make each run less coherent" and "Shop 1 decides the build", proposals 1, 2 and 3. With all 64 items a run averages 0.95 merges against 3.48 with the 18 starter items, and multi-part combos are rarely offered together.

## Data shape

- Rename `RunState.unlocked` to `RunState.pool` (`src/types.ts:347-348`). Meaning: the item types this run may offer; `undefined` means every item. Migrate every reader and writer (`src/systems/shop.ts:63-65` and `:104-113`, `src/flow.ts:59`, `createLabRun`, `createSimRun`, `src/buildlab/run.ts:141`, tests) and delete the old name in the same change. Lab, sims, build lab and bot keep exactly the contents they have today under the new name.
- Add `RunState.featured?: RecipeId[]` (the combos this run's stock was built around, for display) and `RunState.openers?: ItemTypeId[]` (the shop-1 offers, see below).
- New module `src/systems/stock.ts` exporting a pure `drawStock(input, rng)` that returns `{ pool, featured, openers }`. Input: the source item list, the starting weapon, the theme, and the set of unlocked items the player has not seen yet.
- New tuning table in `src/data/` (next to `ECONOMY` in `src/data/waves.ts` or its own small file): `STOCK = { size: 24, minWeapons: 6, featuredCombos: 3, staples: ['canopener'], freshMax: 2 }`, and `ECONOMY.ownedWeight = 2.5`.

## Rules

1. **Separate stream.** Add `stockRng(seed)` to `src/systems/rng.ts`, derived from the run seed the way `combatRng` is. `drawStock` uses only that stream. `flow.rng` draw counts must not change because of the stock.
2. **Where it applies.** Only `flow.startRun` (real runs and daily runs) draws a stock. It sets `state.pool`, `state.featured`, `state.openers`. Draw after the seed exists.
3. **Source list.** A normal run draws from the player's unlocked shop items (`unlockedItems()` minus `noShop`). A daily run draws from every shop item (all of `ITEM_IDS` minus `noShop`), so every player gets the same daily stock from the same seed regardless of unlocks.
4. **No narrowing for small pools.** If the source has at most `STOCK.size` non-legendary items, `pool` is the whole source (a fresh profile with 17 regular items sees no change).
5. **Composition, in order, de-duplicated, never above `STOCK.size` non-legendary items:**
   1. The starting weapon and every other part of every recipe that contains the starting weapon, when those parts are in the source.
   2. The theme's bias items (`DEPARTMENTS[theme].shopBias`, `src/data/departments.ts`), non-legendary ones.
   3. Up to `STOCK.freshMax` unlocked items the player has not seen yet (profile `seen` lacks `item:<id>`), so a fresh unlock shows up in the next run.
   4. `STOCK.staples` that are in the source.
   5. Featured combos: pick recipes uniformly at random among those whose parts are all in the source and not legendary, skipping any that would exceed the size, until `STOCK.featuredCombos` are featured. Add all their parts. Record them in `featured`.
   6. Random weapons from the source until the pool holds `STOCK.minWeapons` weapons.
   7. Random fill from the source to `STOCK.size`.
   8. Exactly one legendary from the source, chosen at random, added on top (legendary offers and the mini-boss crate legendary then come only from it). If the source has none, none.
6. **Owned-item weight (proposal 2).** In `weight()` (`src/systems/shop.ts:35-39`), any owned type (cart or shelf) below tier 3 that is not legendary gets `ECONOMY.ownedWeight` (2.5), for weapons and non-weapons alike. Other cases keep today's weights. Owned at tier 3 or higher keeps today's weight.
7. **Shop-1 pick (proposal 3).** Delete `STARTER_WEAPONS[*].guarantee` (`src/data/items.ts:78-82`) and the unread `ItemContent.starterGuarantee` and `ItemContent.shopBias` fields (`src/engine/define.ts:301-303`). `drawStock` computes `openers`: one part from each of up to 3 different recipes that contain the starting weapon (prefer the cheapest non-legendary part not already chosen), drawn with the stock stream. Shop 1's guarantee path (`rollOffers` with `guarantee`, `src/systems/shop.ts:61`) offers the openers instead of the old guarantee, then fills the remaining slots as today. If a weapon has fewer than 2 recipes, fill openers with that weapon's other recipe parts. This may change how many `flow.rng` draws shop 1 makes; that is allowed for shop 1 only.
8. **Display.** In the shop's combo panel (`src/ui/shop.ts:170-206`), show one line "Featured this run" listing the featured combos. A combo the player has not discovered shows as "???" with its part count, matching how the panel already hides undiscovered combos. EN and DE.
9. **Build lab.** Extend `RunOptions.pool` (`src/buildlab/run.ts:31`) with `'stock'`: all items unlocked, then `drawStock` exactly as a real run. Keep `'all'` and `'starting'` unchanged. Document `--pool stock` in `docs/buildlab.md`.

## Tests (behavior)

- A fresh profile's run pool equals today's starting shop items.
- With everything unlocked, the pool has 24 non-legendary items plus 1 legendary, contains the starting weapon, all its recipe partners and the theme bias items, and has at least 6 weapons.
- Same seed and same unlocks give the same stock; the daily stock is identical for two different unlock sets.
- Featured combos are complete inside the pool.
- Shop offers never include an item outside the pool across many seeds (offers, rerolls, stockroom, mini-boss crates).
- A Test Lab run and a sim run still offer every item.
- Shop 1 offers the openers, which belong to at least 2 different recipes with the starting weapon.
- An owned non-weapon is offered more often than an unowned one with equal base weight, over a fixed set of seeds.
- With the same seed, the offers of shop 2 onward are identical whether or not the stock code ran an extra time (stock draws do not touch `flow.rng`).

Golden snapshots should not change. If they do, find out why before declaring.
