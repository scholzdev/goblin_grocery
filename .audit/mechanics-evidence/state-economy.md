# Audit: state-economy

Scope covered: `src/state/run.ts`, `lab.ts`, `sim.ts`, `settings.ts`, `store.ts`, `src/systems/shop.ts`, `src/systems/inventory.ts` (placement rules), `src/systems/shortcut.ts`, `src/engine/actives.ts` (charges), `src/data/waves.ts` (ECONOMY, SHOP_LEVELS), `src/data/sets.ts` (setGains/setCount), the rule paths of `src/ui/shop.ts` (buy, combine, drag/drop, pad drop, reroll, lock, services), and the phase transitions in `src/flow.ts`.

Repro: `tests/_audit/state-economy-repro.test.ts` (6 tests, all pass, so each asserted wrong behavior is real). Deleted before handback.

Counts: critical 0, high 0, medium 3, low 5.

## Bugs

### 1. Merging drops the consumed copy's per-instance counters (Basil kills, Scoby age); a stinking Fresh Fish can be made fresh again
Severity: medium. Label: **confirmed** (repro test).

`src/state/run.ts:211-214`
```ts
  if (a.where === 'grid') inv.placed.splice(inv.placed.indexOf(a.inst), 1);
  else inv.shelf[a.slot] = null;
  b.inst.tier = (b.inst.tier ?? 1) + 1;
  if (a.inst.double) b.inst.double = true;
```
Only `tier` and `double` move from the consumed copy `a` to the target `b`. `kills` (Potted Basil, whose text says "the count stays on the plant"), `age` (Scoby growth, Avocado ripeness, Fresh Fish rot), `binderSold` (Collector's Binder) and `slot` (picked active key) are dropped.

The natural drag, shelf copy onto cart copy, keeps the cart copy's counters. The loss happens with the reverse drag, or with bug 2's button.

Scenario: Basil in the cart with 200 kills, a newly bought ★1 Basil on the shelf. Drag the cart Basil onto the shelf Basil, so `mergeItems(s, cartUid, shelfUid)` runs. The result is a ★2 Basil with 0 kills (repro: `kills` undefined). Same path with Fresh Fish: a stinking fish (`age 5`) dragged onto a fresh shelf fish gives a ★2 fish with `age 0`. Its crit is back and the shop-price markup is gone, although the item text says it stinks "for good".

Fix: carry counters into the target. `kills` takes the sum or the max. `age` takes the max, so rot and growth survive. `binderSold` is summed only when both Binders share `binderFamily` (otherwise keep the target's binding). If the target has no `slot`, it takes `a.slot`.

### 2. The inspector's Combine button on a shelf item consumes the cart copy
Severity: medium. Label: **confirmed** (traced).

`src/ui/shop.ts:344-346`, used at `:448/453` and `:597-600`
```ts
  // Prefer consuming a shelf copy so the cart layout stays as it is.
  return inv.shelf.find(same) ?? inv.placed.find(same) ?? null;
...
    const r = mergeItems(s, partner, uid);   // partner consumed, uid (the inspected item) is the target
```
Shelf items render with `.item[data-uid]` too, so a right-click opens the inspector with the Combine footer. Scenario: a ★1 Toaster in the cart and a new ★1 Toaster on the shelf. Right-click the shelf copy and press Combine. `mergePartner` finds no other shelf copy, so it returns the cart Toaster. The cart Toaster is consumed and the ★2 lands on the shelf, which does not fight. The cart has a hole, and every counter on the cart copy is lost (bug 1). That breaks the comment's own promise that the cart layout stays.

Fix: when the inspected item is on the shelf and the partner is in the cart, swap roles with `mergeItems(s, uid, partner)`, so the cart copy is always the target.

### 3. Set badge on a double pack promises +1 when a double of that type is already in the cart
Severity: medium (it can sell a 1.5x-priced pack on a false level-up). Label: **confirmed** (repro).

`src/data/sets.ts:46-48`
```ts
    if (seen.has(type) && !(double && add === 2)) continue;
    if (have >= SET_THRESHOLDS[2]) continue;
    const to = have + (seen.has(type) ? 1 : add);
```
If the placed copy is already a double, `have` already counts it as 2. `setCount`/`setLevels` take the max weight per type (`sets.ts:25,32`), so a second double adds 0. `setGains` still reports `to = have + 1`. The repro shows `setCount` unchanged after placing a second double fan. The offer card's set badges (`ui/shop.ts:251-252, 382`) can then show a "level up" that never happens. Double pack is in handoff.md's "built but not tested" batch.

Fix: in the `seen.has(type)` branch, add 1 only when no placed copy of `type` is already a double (track the max weight seen per type).

### 4. Shop offers legendaries the player already owns
Severity: low. Label: **confirmed** (repro: an owned legendary was offered by `rollOffers` with `forceLegendary`).

`src/systems/shop.ts:65`
```ts
  const legends = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].legendary);
```
`rollMiniCrates` (line 108) excludes owned legendaries (`&& !owned.has(t)`), but `rollOffers` does not. The inspector says "Legendaries are unique" (`i18n/ui.ts:573`) and they cannot merge (`run.ts:206`). For Laser (weapon) and Gold Star / Power Strip (modules, per-instance `touching`), a duplicate still works. For the passives Expired Coupon and Snack Bag, player hooks run once per type (`engine/build.ts:144`, `env.top(id)`), so a second copy adds nothing. The player pays legendary price for a dead item, and the shop's legendary roll is wasted on it.

Fix: filter `legends` by the owned set (cart + shelf), as `rollMiniCrates` does. Or, if duplicates are intended, at least exclude owned passive legendaries and reword "unique".

### 5. Shortcut Key "once per run" can be used again by buying another key
Severity: low (rule mismatch, design call). Label: **confirmed** (repro: `canShortcut` true with a spent key in the cart plus a new key).

`src/systems/shortcut.ts:11-12, 18-21`
```ts
export const findKey = (inv: Inventory): ItemInstance | null =>
  [...inv.placed, ...inv.shelf].find((i): i is ItemInstance => !!i && i.type === KEY_ITEM) ?? null;
```
The item text and `docs/new-items-plan.md:128` say "Works once per run". The shop pool (`systems/shop.ts:64`) keeps offering `shortcut` after one was spent, and every unspent key opens the Staff Only door again. Merging two keys into a ★2 key also silently turns two skips into one.

Fix: if "once per run" is the rule, check `state.skippedAisles` (already tracked) in `canShortcut`, or drop `shortcut` from the pool once one is owned or spent. Otherwise reword the text to "once per key".

### 6. Test Lab sandbox: every arena↔editor trip ages perishables and Sourdough; actives never refill
Severity: low (Test Lab only). Label: **confirmed** (repro for aging; traced for charges).

`src/flow.ts:155` (`labToShop` → `openShop`) → `src/state/run.ts:357` (`ageItems`), and `src/flow.ts:162-171` (`labToArena`, no `refillCharges`)
```ts
    openShop(s, rng);      // labToShop: ageItems + Sourdough rise + offer/flavor reroll
...
    s.phase = 'combat'; s.shop = null; s.coinLog = []; s.hp = s.build.maxHp;   // labToArena: charges stay spent
```
The sandbox "never advances" (`run.ts:101`), but four editor trips age an Avocado by 4 (repro). It browns, Fresh Fish stinks, and Sourdough rises a star every 2 trips. `refillCharges` runs only in `startNextWave` (`run.ts:403`), so actives spent in the sandbox stay empty on the next trip.

Fix: skip `ageItems` in `openShop` when `state.labSandbox` (or move aging to `finishWave`), and call `refillCharges(s.inventory)` in `labToArena`.

### 7. Cart upgrade can shrink an off-ladder cart (sims)
Severity: low. Label: **confirmed** (repro: an 8x4 cart upgrades to 6x5, cols 8 → 6).

`src/state/run.ts:463, 484`
```ts
const cartStep = (inv: Inventory): number => ECONOMY.cartSizes.findIndex(([c, r]) => c > inv.cols || r > inv.rows);
...
  [state.inventory.cols, state.inventory.rows] = ECONOMY.cartSizes[i];
```
A sim with `cartSize: [8, 4]`, which `validateSim` allows (1..12), shows "Bigger cart". The service buttons are not hidden in lab or sim runs (`#shop.lab` hides only `.col-left`, `style.css:632`). Buying it sets 6x5, and items in columns 6-7 are now out of bounds while still in `placed`. The ECONOMY comment "placed items never move" assumes the ladder. No shipped sim triggers it today: only `src/sims/example.ts` sets a size, and `[6, 4]` is on the ladder. The lab form and `normalizeSetup` restrict lab carts to the ladder.

Fix: assign `Math.max` per dimension, or hide the service when the current size is not on the ladder.

### 8. Victory credits a skipped aisle as cleared
Severity: low (score +250). Label: **confirmed** (traced).

`src/flow.ts:209`
```ts
    s.stats.wavesCleared = BOSS_WAVE - 1;
```
`takeShortcut` skips an aisle without `finishWave`, so `wavesCleared` is one short. Victory overwrites it to `BOSS_WAVE - 1`, and `scoreOf` (`flow.ts:286`) pays 250 for the skipped aisle. The plan says the skip gives "no clear bonus".

Fix: use `BOSS_WAVE - 1 - (s.skippedAisles?.length ?? 0)`, or leave the counter as `finishWave` maintains it.

## Design question (confirmed behavior, documented as deliberate)
**Daily runs do not give everyone the same shops.** `openShop` rolls offers from `flow.rng` (`run.ts:364`). Credited kills draw kill-coin and bread rolls from the same stream (`ArenaScene.ts:843-847`). The checkout sweep's uncredited kills draw nothing (`killEnemy` returns at line 830). So the stream position at each shop depends on how many enemies the player killed, and two players on the same `dailySeed` (`flow.ts:53`) get different offers, doors and crates from shop 1 on. `docs/item-hooks-refactor.md:611` says these rolls stay on `flow.rng` on purpose and leaves "a fully separate stream" for a later phase. It is the operator's call whether daily runs should share shops. If so, seed an economy stream per shop index, the way `combatRng(seed, aisle)` works.

## Checked and fine (no report)
- Shop lock: unsold offers keep their slot and price, sold slots refill fresh, reroll is blocked while locked, and the lock carries through shortcut and overtime (`run.ts:362-364, 402`; `systems/shop.ts:57-78`).
- Reroll cost and bonus/free-reroll bookkeeping (`run.ts:302-311`, `systems/shop.ts:41-46`). Repair cost and once-per-shop (`run.ts:314-323`).
- Interest: Checkout level ≥2, cap 5/8, computed after the clear bonus (`run.ts:391-393`). The Fresh Fish markup survives Checkout's assignment through hook order (checkout 10, coupon 20, fish 30).
- Double pack: never legendary, never a guarantee slot. `double` survives move and merge, and `weightIn` counts it only in its family.
- Placement: bounds, overlap, rotation normalization, multi-cell clamp in drag, Sourdough growth fit checks on merge, upgrade and rise.
- Phase guards: every shop op checks `phase === 'shop'` (`takeStockroomItem` and `addCoins` run mid-combat by design). `hurtPlayer` ignores damage during checkout, so death cannot race `endWave`.
- `upgradeItem` has no shop UI caller, but `buildlab/run.ts:76` uses it, so it is not dead.

## Mechanics notes (not bugs)
- A double pack costs 1.5x but sells and merges as one copy (`sellPrice` ignores `double`).
- `buyOffer` refuses on a full shelf even when the offer would combine into an owned copy (`run.ts:274-275`). The card shows "Combines" and "Shelf full" at once.
- Locking is free and kept offers keep their old price, so a lock also dodges inflation and later Checkout or Fish price changes.
- Sourdough ★1 is always rot 0 (normalized), so it can only rise to the right. A cart Sourdough with no free cell to its right waits indefinitely unless moved.

## Out of scope leads
- `src/systems/rng.ts:25` and `ArenaScene.ts:100` say hazard and event rolls use the combat rng, but `ArenaScene.ts:171` (`rollEvent(..., flow.rng, ...)`) and `src/scenes/events.ts:202-237` draw from `flow.rng`. `docs/item-hooks-refactor.md:611` lists event rolls as kept on `flow.rng`, so the two code comments are stale.
- `src/state/settings.ts:45` spreads stored settings without validating `tutorialSeen` or the numeric fields (only `keys` is sanitized).
