# Unit balance: reshape the curve and retune the integrated game

Background: `docs/audit/mechanics.md` proposal 5 and "Difficulty is flat, then a cliff, then a coin flip". This unit runs on the integrated branch after every feature unit is merged (stock, owned weight, shop-1 openers, tier-weighted sets, base interest, door previews, death recap, goal unlocks, weapon ★3 behaviors). Those changes move balance, so this unit measures first and then tunes.

Baseline (fixed proxy, current mechanics before the features, 600 runs = 4 starters x 3 weapons x 50, seed 1): `.audit/baseline-metrics.md` in the main checkout (/Users/scholzf/dev/goblin_grocery/.audit/baseline-metrics.md). Raw files: /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/baseline/all.json and starting.json. Full pool: win 26.2%, merges 1.00/run, ★3 0.02/run, combos at end 1.57/run, aisle-4 death share 33%.

Use exactly the same flags for every measurement: `npm run buildlab -- --runs 50 --seed 1 --starter all --weapon all --pool stock --quiet --out <file>` (and `--pool starting` for the new-player view), then `node tools/mechanics-metrics.mjs <baseline> <after>`. Keep every output file under /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/balance/.

## Targets (judgment targets, proxy numbers, not human win rates)

On `--pool stock`, Day shift:
- merges per run at least 2.0
- combos at run end per run at least 2.0
- ★3 items per run at least 0.15
- win rate between 20% and 35%
- aisle 4's share of all deaths below 28%, and aisles 1 and 2 no longer completely free (at least some HP lost on average in aisle 2)
And on `--pool starting`: win rate not above 55% (new players should still be able to lose).

## Steps

1. **Measure first.** Run the stock and starting batches on the integrated branch before any change. Record the metrics against the baseline. Write a short findings note: what moved and why you think it moved.
2. **Restock decision.** If merges per run on the stock pool is below 2.0, implement a "Restock" offer: from shop 3, one of the four offer slots is a copy of a random owned item below tier 3 at its normal inflated price, marked with a small "Restock" sticker (EN/DE). If merges are already at or above 2.0, skip it and say so.
3. **Curve reshape (proposal 5).** In `src/data/waves.ts`: aisles 1 and 2 last 35 to 40 s instead of 60 s, with spawn counts adjusted so the enemies per second rise; aisle 4's new enemy types are spread over aisles 3 to 5 so the mini-boss is the main new thing in aisle 4. Then retune counts, `hpScale` and `dmgScale` per aisle to hit the targets.
4. **Other knobs, only if a target needs them:** `SET_THRESHOLDS` (if tier-weighted sets made level 3 too common; check the per-set level-3 share), the interest caps and `inflationPerShop`, `ECONOMY.ownedWeight`, `STOCK.size`, and individual ★3 behavior tunes if one weapon's win rate is far above the others. Change one knob per commit.
5. **Shifts.** Check Evening and Late with `--shift 1` and `--shift 2`. If Evening is below 12%, soften the Evening step toward 15%.
6. **Trail.** Append one row per accepted change to `docs/balance-hillclimb.tsv` in the same format as its existing rows (metric before, after, change, file). Revert any change that does not move its target.

## Rules

- One knob per commit, each commit with its before and after metric in the message body.
- Never tune by changing tests. If a test pins an old tuning number that you changed on purpose, update the pin and say so.
- Golden snapshots: weapon tunes and wave tables may change build.json and text.json. Regenerate as your last commit and declare the prefixes.
- Update `docs/buildlab.md`'s "Balance hillclimb" section with the new results, labelled as proxy, with a note that a human playtest is still needed to calibrate.

## Report

Before and after table of the target metrics, every knob changed with its effect, the Restock decision, and which targets you could not reach and why.

## Findings from the feature units to handle here

- **Set thresholds.** With tier-weighted sets and thresholds `[2, 3, 4]`, a lone ★3 item reaches level 2 in every set it belongs to (a ★3 Toaster alone gets Kitchen, Heat and Electric L2). Measure the per-set L2 and L3 shares on the stock pool and retune `SET_THRESHOLDS` (for example `[2, 4, 6]`) so a set still needs more than one item. Keep the shop's set texts consistent with the numbers.
- **Vacuum ★3.** The shipped ★3 (double coin pickup radius) has almost no value, because coins never expire and the end of an aisle collects every coin. Replace it with one behavior that changes how the Vacuum plays, following `specs/weapon-star3-common.md` (one short line on the ★3 card, numbers in the tune, gated with the same helper the other close-range weapons use, tests at ★2/★3/★4). For example: each pulse also slows enemies in its radius briefly.
- **Goal unlock needs.** The goal-unlocks unit found that several needs fall far below the intended 10 to 30 percent of greedy runs (snowcone 0.5%, and others; see its report in `scratchpad/w2-results.json`). Recalibrate every goal's `need` on the integrated stock pool so each lands in that band, and keep the EN and DE need texts in step. Note that goldstar's progress starts at 1/3 because `maxTier` is at least 1; make its progress start at 0 (for example measure `maxTier - 1` against need 2) if that reads better in "Almost there".
- **Cooker ★3 and explode combos.** The second pot fires every `pattern:explode` combo again (Shrapnel, Pressure Point, Fireworks Show). Check the Cooker's win rate and combo damage on the stock pool; tune the second pot's tune if it is far above the other weapons.
