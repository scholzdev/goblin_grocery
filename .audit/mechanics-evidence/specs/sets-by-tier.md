# Unit sets-by-tier: a set counts tiers, not just distinct items

Background: `docs/audit/mechanics.md` proposal 7 and "Tiers barely pay off"; `docs/audit/bugs.md` bug 6 (`setGains` mispredicts levels with double packs). Cleaning and Frost level 2 and 3 are almost never reached, and merging has little reason to exist.

## Rule

- An item's **set weight** is its tier, plus 1 if it is a double pack: ★1 = 1, ★1 double = 2, ★2 = 2, ★2 double = 3, ★3 = 3, Gold Star ★4 = 4.
- A set's count is the sum over distinct item types in that set of the **largest** weight among that type's placed copies (today's "max per type" rule, with tier now in the weight). Shelf items still do not count.
- Thresholds stay `SET_THRESHOLDS = [2, 3, 4]` (`src/engine/define.ts:84`) for now. A later balance unit may retune them. Keep them as the single source of truth.
- `setGains` (`src/data/sets.ts:39-52`) becomes the difference `setCount(placed + candidate) - setCount(placed)` per set of the candidate, where the candidate carries its tier and double flag. This fixes bug 6. The shop's offer badges and set panel (`src/ui/shop.ts:211-259`, `:382`) and the inspector use it, so passing the offer's tier and double flag through is part of this unit.

## Text

- Update every player-facing text that says a set counts "different items" so it says what counts now (for example "set points: ★ tier per item"), in EN and DE. That includes set panel copy in `src/ui/shop.ts`, set texts produced by `setBonus`, the double-pack chip text (`setDouble`, `src/i18n/ui.ts:465` and its DE twin), and any tutorial copy that explains sets.
- The inspector shows how much an item counts toward each of its sets when that is more than 1 (for example "Kitchen +2").

## Tests (behavior)

- A cart with one ★2 Kitchen item and one ★1 Kitchen item has Kitchen count 3 (level 2). The same cart with both at ★1 has count 2.
- Two copies of one type count once, at the larger weight.
- A ★1 double pack counts 2; a ★2 double pack counts 3; Gold Star ★4 counts 4 without errors.
- `setGains` agrees with the real count after adding the candidate, including both scenarios from bug 6 (`[bell(double), pricegun]` with a double Bell offer; `[bell, bell(double)]`).
- Update the pinned tests that assume distinct-item counting (`tests/golden/carts.ts:105` builds set carts with `lv + 1` items; `tests/set-stickers.test.ts`; `tests/rules.test.ts` set cases). Pin the new contract, do not delete coverage.

Golden: build.json set levels change for carts with ★2/★3 items, and text.json set texts change. Declare the exact prefixes.
