# Unit goal-unlocks: unlocks that ask for a way to play

Background: `docs/audit/mechanics.md` proposal 12. 37 of 53 unlocks come from just playing (reach aisle N, lifetime kills, coins, runs, wins, losses). Unlock checks only see lifetime `ProfileStats` (`src/data/unlocks.ts:28-46`) and run only in `recordRun` (`src/state/profile.ts:111-135`).

## Fix first (own commits, before the feature)

1. **Overtime never reaches lifetime stats** (`docs/audit/bugs.md` bug 29). `flow.finish`'s overtime branch (`src/flow.ts:238-247`) calls only `recordOvertime` and `recordFinish`. Kills, coins and aisle clears after the boss are lost, and unlocks are not evaluated. Snapshot the counted values at victory, fold the overtime delta into `profile.stats` at the overtime finish, and evaluate unlocks, merging new ids into `fresh.unlocks`. Never count the pre-boss part twice.
2. **Staff Only double count.** A won run that used the Staff Only skip bumps `deptClears.boss` twice: the skip pushes a placeholder into `route` (`src/state/run.ts:430-438`), so the boss entry falls inside `slice(0, wavesCleared)` in `recordRun` (`src/state/profile.ts:126-131`), and `:131` bumps it again. Make the slice exclude the boss entry in every case.
Each fix gets a behavior test that fails before it.

## Data shape

- `RunSummary`, built by a pure function from the finished `RunState`: `won`, `wave`, `starter`, `weapon`, `theme`, `shift`, `daily`, `kills`, `coins`, `sets` (level per set at run end, from `setLevels`), `combos` (active at run end), `reactions` (counts per reaction from `stats.damage.reactions`), `damageByWeapon`, `maxTier` (highest tier in the final cart).
- An unlock's condition becomes a discriminated union:
  - `{ type: 'milestone', check(stats), progress(stats) }` (today's entries, unchanged in behavior),
  - `{ type: 'goal', measure(run: RunSummary): number, need: number }`.
- `Profile.goalBest: Record<string, number>` stores the best `measure` seen per goal. A goal unlocks when `goalBest[id] >= need`. Its progress is `[min(best, need), need]`, so it shows in "Almost there" and in the catalog bars.
- `load()` (`src/state/profile.ts:53-63`) defaults `goalBest` to `{}` for saves without it. An unlocked id is never removed, even if its condition changed.
- `evaluateUnlocks(run?)` updates `goalBest` from the summary first, then evaluates every entry. `recordRun` and the overtime finish pass the summary. Lab and bot runs still never touch the profile.

## Convert these entries (about a quarter of the table)

Turn these mid and late milestones into goals. The item stays the same; only the condition changes. The suggested measure is a starting point. Choose each `need` so that roughly 10 to 30 percent of greedy build-lab runs on the full pool reach it (run `npm run buildlab -- --runs 200 --seed 1 --pool all --out <file>` and read the per-run reactions, sets, combos and kills). Record the chosen numbers and the measured share in your report.

| Item | Today | Goal (in one run) | Measure |
|---|---|---|---|
| snowcone | Clear 5 Frozen aisles | Win with the Frost set at level 2 | won ? frost level : 0, need 2 |
| moldybread | Discover 5 combos | Trigger N Detonates | reactions.detonate |
| goldstar | Discover 7 combos | Finish with a ★3 item | maxTier, need 3 |
| energy | 500 lifetime kills | Return N groceries | kills |
| scoby | 400 lifetime kills | Deal N poison damage | stats.damage.byType.poison |
| leafblower | 300 lifetime kills | Reach aisle 6 with only one weapon in the cart | wave if one weapon else 0, need 6 |
| barter | 600 lifetime coins | Earn N coins | coins |
| pricegun | 400 lifetime coins | Win with the Checkout set at level 2 | won ? checkout level : 0, need 2 |
| doublebag | Discover 4 combos | Have 3 combos active at once | combos.length |
| binder | Discover 5 combos | Finish with a set at level 3 | max set level, need 3 |
| laser | Win 3 runs | Win with 3 or more weapons | won ? weapon count : 0, need 3 |
| bowlingball | Reach aisle 6 | Trigger N Shatters | reactions.shatter |

Keep the early milestones (reach aisle 3 or 4, finish a run, the loss unlocks, the theme unlocks) as they are. If a measure needs data the summary cannot provide, pick a different goal from the same data and say why.

## Text

Every converted entry gets new `need` text in EN (`src/data/unlocks.ts`) and DE (`src/i18n/data-de.ts:46` area), saying "in one run" where it applies.

## Tests (behavior)

- The overtime and Staff Only fixes (above).
- A finished run whose summary meets a goal unlocks it and reports it in the run-end result.
- A run that falls short raises `goalBest` but does not unlock; a later better run unlocks.
- A goal shows in `nearUnlocks` when `0 < best < need`.
- A profile saved without `goalBest` loads, and an item already unlocked under the old condition stays unlocked.
- Lab and bot runs do not change `goalBest`.

Golden snapshots should not change.
