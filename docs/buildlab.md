# Build-lab (Phase 1a + 1b)

A headless player. It plays whole runs without Phaser: the real run, shop and build rules, a greedy shop policy, and a combat proxy on `FakeCtx` instead of the arena. Seeded, JSON out. Phase 1b adds an optimizer that evolves shop policies (a flat JSON genome) and a balance report of which items dominate and which are dead.

It is a balance instrument, not a replica of the game. It answers "does this build kill faster / survive longer than that one", not "what is the win rate". Read the deviations below before trusting an absolute number.

## Run it

```
npm run buildlab -- --runs 50 --seed 1 --starter toaster --out buildlab-out/run.json
npm run buildlab -- --runs 50 --seed 1 --starter all
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--runs N` | 50 | Runs per (starter, weapon) pair. `--starter all` plays N runs for each of the 4 characters. |
| `--seed N` | 1 | Base seed. Run `i` gets `runSeed(seed, i)` (mixed, so neighbours are unrelated). |
| `--starter ID\|all` | `toaster` | Character (perk): `toaster`, `pan`, `coupon`, `night`. |
| `--weapon ID\|all` | `toaster` | Starting weapon: `toaster`, `pan`, `nailgun`. |
| `--shift N` | 0 | Difficulty (0 = Day Shift). |
| `--theme ID` | `main` | Run theme. Only the data-driven department effects apply (see deviations). |
| `--pool all\|starting\|stock` | `all` | Which items may appear in shops: every item (like the Test Lab), a fresh profile's unlocks, or `stock`: the stock a real run draws with every item unlocked (`src/systems/stock.ts`). Only `stock` has shop 1's openers; `all` and `starting` roll shop 1 like any other shop at flat weights. |
| `--policy NAME` | `greedy` | Registered in `tools/buildlab.ts`. |
| `--out FILE` | `buildlab-out/run.json` | Pretty-printed JSON. `buildlab-out/` is git-ignored. |
| `--quiet` | | No summary on stdout. |

The same seed always gives the same JSON, except `meta.durationMs` and `meta.gitRev`. A run takes about 25 ms (40 to 50 runs/s on a laptop).

No new dependency: the content registry uses `import.meta.glob`, which plain node cannot load, so `tools/buildlab.mjs` starts a Vite server in middleware mode and loads `tools/buildlab.ts` through `server.ssrLoadModule` (Vite is already a dev dependency; `vite-node` is not part of Vitest 4). The lab code under `src/buildlab/` is imported by nothing in the game, so it is not in the bundle.

## Layout

| File | What |
| --- | --- |
| `src/buildlab/run.ts` | `playRun`, `runBatch`: the orchestration (flow.ts without Phaser), the shop loop, JSON assembly. |
| `src/buildlab/combat.ts` | `PROXY` (every tunable) and `playAisle`: one aisle on `FakeCtx`. |
| `src/buildlab/policy.ts` | `Policy` interface, `ShopAction`, `bestPlacement`, `createGreedyPolicy`. |
| `src/buildlab/report.ts` | JSON types, `summarize`, `formatSummary`. |
| `src/buildlab/metrics.ts` | `computeMetrics`, `formatMetrics`: the mechanics metrics over a report. |
| `tools/buildlab.mjs`, `tools/buildlab.ts` | Launcher and CLI. |
| `tools/mechanics-metrics.mjs` | The mechanics-metrics CLI. |
| `tests/buildlab/*.test.ts` | Determinism, full runs, placements, proxy sanity, crates, JSON shape, metrics. |

## What a run does

The order of calls is `flow.ts`'s: `createRun` (seed, character, weapon) -> `pool` set (`POOLS` in `src/buildlab/run.ts`) -> for each aisle: play it -> `finishWave` -> `openShop` -> policy acts -> `leaveShop` -> policy picks a door -> `chooseDoor` -> `startNextWave`. Everything in the shop is the real rules from `state/run.ts` (`buyOffer`, `mergeItems`, `moveItem`, `upgradeCart`, `repair` ...); an action the rules refuse is logged with its reason and skipped.

Randomness, as in the game: `mulberry32(seed)` is `flow.rng` (shop rolls, doors, the wave plan, spawns, kill coins); `combatRng(seed, aisle)` is the weapons' rng (crits, statuses, hook rolls) exactly as the arena creates it; the policy has its own `mulberry32(seed ^ 0x51ed270b)`; the proxy's spots and exposure rolls use a third stream (`combatRng(seed ^ 0x1ab5, aisle)`), so the damage model never shifts a weapon's crit rolls.

Aisle by kind:

- Aisle 1..7: the real `waveSpawnPlan` (mix, count, hp / speed / damage scales, department, modifier, shift), groups scheduled like `ArenaScene.planWave` (same draw order, same ramp, same entries, the 70-enemy cap), elites by `eliteChance` + modifier bonus with the real affixes (swift, tough, splitter, plated; pickpocket only rolls), melon slices, splitter copies. The aisle ends after its `duration` (38 s in aisles 1 and 2, 60 s after), remaining enemies swept without credit (as `beginCheckout` does).
- Aisle 4 (mini-boss, unless the door was a stockroom): the boss variant is rolled from `flow.rng`, arrives at 8 s with the real `miniBossDef`, summons and volleys; the aisle ends when it dies; `rollMiniCrates` is resolved by the policy (`pickCrate`); the item goes through `takeStockroomItem` (shelf, or coins if the shelf is full).
- Stockroom door: no fight; `rollStockroom` resolved by `pickStockroom`.
- Aisle 8 (boss): the department boss arrives at 1.6 s, six escorts by the plan, the Manager's cycle (volley, charge, summon, special), enrage after 61.6 s. Killing it is the win. Overtime after the boss is not played.

## The combat proxy

Real, not modelled: the weapon patterns (`FakeArsenal` runs every pattern), item and combo and set hooks, the damage pipeline (crit, affinity, mark, armor, Shred, Wet, statuses, burn and poison ticks driven here every step, reactions), kill coins (`killCoins`, `giftcardCoins`, `killCoinMult`, the 0.4 drop chance), `build.regen`, bread, honey healing (`healTargets`), the Sanitizer's cleanse (`cleanseAura`), Weaken on enemy damage (`weakenedDamage`), the player hit path (`FakeCtx.hurt`: i-frames, `onPlayerHit` hooks such as Bubble Wrap), the damage breakdown (`systems/damageStats`, including reaction counts). The effects a hook spawns run too: `playAisle` gives its `FakeArsenal` to the `FakeCtx` (`fake.arsenal`), which routes `spawnShot`, `spawnPool`, `sweep`, `explode` and `beam` to it as `PhaserCtx` routes them to the scene's arsenal (Ray Gun bolts, Shrapnel fragments, Kettle Corn kernels, the Reheat / Pressure Point / Sizzling Skillet fire pools, Power Surge's aftershock). The Punch Card runs on the functions `ArenaScene` calls (`rollPunchCard` at the aisle start, `punchKill` on credited kills, `punchHit` on landed hits, `punchTick` on the aisle clock, `payPunchCard` on a met goal); the free reroll then comes from `openShop`. The Tough affix regenerates from `lastHitT`, which every hit that is not damage over time sets, as in the arena.

Changed after the October hillclimb. Before, `FakeCtx` only logged the effects a hook spawns: with Ray Gun the Nail Gun dealt 0, and fire pools, fragments, kernels and aftershocks did nothing. The Punch Card never rolled, and a burn or poison tick reset the Tough regen timer. With these fixes and the partial combo credit in greedy placement (see "The greedy policy"), 1200 greedy Day runs (seed 1, 100 per character and starting weapon) went from 25.8% to 28.4% wins, mostly from Nail Gun starts (13.8% to 21.3%). The hillclimb's metric (toaster start, 800 runs, seed 1) barely moved, 26.0% to 26.1%: toaster runs build Toast Mode and rarely own an affected combo.

Modelled (the part that is a guess):

- Enemies spawn at the real entry points, walk straight to the cart at their speed (real slow factors, stun freezes them, Swift x1.4, enrage) and stop where they would attack: contact distance, a spitter at its preferred distance (270 px), a Honey Jar at 220 px. The cart stands still in the middle (`PLAYER_START`). Each enemy picks a preferred angle (its approach angle +/- `angleJitter`) so a group forms a crescent.
- Damage to the cart is turned into discrete hits, so the real i-frames and armor hooks apply. A hit lands with a probability: the player is not really standing still.
  - Contact: one attempt per 0.6 s window (the i-frames); the first `contactCap` touching enemies roll `exposure` each; the first success calls `FakeCtx.hurt` with that enemy's contact damage.
  - Telegraphed attacks (baguette swipe after its tell, egg blast, a boss charge): `attackExposure`.
  - Projectiles (spitter fans, boss volleys): real `FakeCtx` hostile shots fly at their speed; the ones that reach the cart roll `shotExposure`. Hooks that kill or reflect enemy shots (`enemyShots`, `killShot`) therefore work.
  - Boss-behavior enemies (mini-boss, Manager) use `bossExposureMult` x the above.
  - Every landing hit uses the enemy's aisle-scaled `contactDamage` / `attackDamage` (elite x1.5), then `weakenedDamage`.
- What that gives (seed 5, 60 runs): a run that never buys anything (bare toaster) dies in aisle 3 to 5 (mean 3.7); the greedy policy reaches 5.0 on average. A cart with no weapon at aisle 6 dies (tests); three upgraded weapons clear a pack of 14 milk in 3.6 s against 27 s for the bare starter.

### `PROXY` constants (`src/buildlab/combat.ts`)

All are written into `meta.proxy` of every report, so a result always says which model produced it.

| Constant | Value | Why |
| --- | --- | --- |
| `dt` | 0.05 | Fixed step. Delayed callbacks (burst repeats, echoes) fire at their own due time on the fake clock inside a step, so only whole-weapon cooldowns are quantized; coarse enough for ~25 ms a run. |
| `exposure` | 0.015 | Chance that one touching enemy's attempt lands, per 0.6 s window. A kiting player takes a small fraction of the contact a stationary cart would (1.0). Set so that the aisle-1 pack (30 milk, 8 dps toaster) costs a few HP, not a life. This is the main difficulty knob. |
| `contactCap` | 3 | A kiting player is touched by a few bodies at a time; a bigger crowd does not multiply the danger linearly. |
| `attackExposure` | 0.10 | Swipes, egg blasts and boss charges are telegraphed but fast and close; dodging them takes a decision, so they land more often than a walker's touch. |
| `shotExposure` | 0.05 | Enemy projectiles are slow (125 to 240 px/s) and readable. Dodging them is the core skill. |
| `bossExposureMult` | 0.5 | Bosses telegraph and walk slowly; a player kites them. Without it the mini-boss (20 contact damage at aisle 4 vs 40 HP) ends most runs on its own. |
| `contactInterval` | 0.6 | `PLAYER.invuln`: one hit per i-frame window. |
| `contactReach` | 30 | The cart hitbox is a capsule 42 back to 46 px ahead of the goblin; an enemy touches it from a bit further than a point. |
| `angleJitter` | 0.9 | Crescent instead of a single stack point. |
| `specialShots` | 6 | A boss "special" (slush, ring, lanes, belt) as a volley of 6 shots. |
| `chargeStun` | 1.1 | The real recovery window after a boss charge (0.75 under half HP, which the proxy applies too). |
| `bossCap` | 150 | A boss aisle without a dead boss after 150 s counts as lost (`cause: 'stalled'`). The real fight would keep going until the cart dies. |
| `clearOvertime` | 30 | `mode: 'clear'` only (diagnostics, tests): how long past the aisle length a fight may run to measure the time-to-clear. |

These values are NOT calibrated against human play (there is no recorded data). They give a greedy bot a plausible spread: it dies in aisles 3 to 6, mostly at the mini-boss, and wins now and then. Change the constants before reading anything into an absolute win rate; the ordering of builds is what the lab is for.

### Aisle record

Per aisle: `aisle`, `kind` (`fight`, `mini`, `boss`, `stockroom`), `department`, `modifier`, `seconds`, `spawned`, `kills`, `leftover` (alive when the aisle ended: the "wipe pressure" signal), `escaped` (Gift Cards), `clearTime` (when the last enemy of the plan died; `null` if some were left), `cleared`, `hpBefore`, `hpAfter`, `damageTaken`, `coins`, `dealt`, `dps`, `died`, `stalled`, `miniDefeated`, `bossDefeated`, `combos` and `sets` of the cart at the start, `weapons`, `loot` (crate / stockroom pick), and `damage`: `byType`, `dot`, `weak`, `resisted`, `shred`, `mark`, `reactions`, `bySource` (weapon item id, `burn`, `poison`, labels).

A regular aisle always lasts its full `duration` (38 s in aisles 1 and 2, 60 s after; that is the game's rule), so `clearTime` is `null` whenever the cart cannot clear the aisle in time; use `leftover` and `dps` to rank builds then. `playAisle(..., { mode: 'clear' })` runs on until everything is dead (at most 30 s extra) when you want a time-to-clear.

## The output

```
{ meta:    { seed, runs, starter, weapon, shift, theme, pool, policy, proxy, gitRev?, durationMs },
  runs:    [{ seed, starter, weapon, shift, theme, result: 'win'|'dead', diedAt?, cause?, aislesPlayed, kills, coinsEarned, merges, rerolls, sells,
              aisles: [...], acquired: [{item, tier, from}], finalBuild: { items: [{id, tier, x, y, rot}], shelf, combos, sets, cartSize, maxHp },
              shopLog: [{ shop, hp, moneyIn, moneyOut, shopLevel, offers, steps: [{kind, ok, item?, tier?, cost?, reason?}], door }] }],
  summary: { runs, winRate, avgAisleReached, itemPickRate, itemFinalRate, itemWinRate, comboRate, comboWinRate, setRate,
             reactionTotals, avgDpsByAisle, avgDamageTakenByAisle, deathsByAisle, byStarter } }
```

`itemPickRate` is the share of runs that ever held the item (starter, buys, crates, stockrooms); `itemFinalRate` the share that had it in the cart at the end; `itemWinRate` the win rate among those runs (the dominance signal); `comboRate` / `setRate` the share of runs where it was active at the start of at least one fight (sets: per level 1 to 3). `avgAisleReached` counts a win as 8. `merges`, `rerolls` and `sells` count the shop actions the rules carried out in the run. A merge turns two copies into one item of the next tier.

## Mechanics metrics

`tools/mechanics-metrics.mjs` turns build-lab output into structural numbers (merges, star tiers, combos, sets, deaths by aisle) and compares two outputs. To measure a change, write one output on the base commit and one on the changed commit with the same options and seed:

```
npm run buildlab -- --runs 600 --seed 1 --pool all --out buildlab-out/a.json --quiet
npm run buildlab -- --runs 600 --seed 1 --pool all --out buildlab-out/b.json --quiet
node tools/mechanics-metrics.mjs buildlab-out/a.json
node tools/mechanics-metrics.mjs buildlab-out/a.json buildlab-out/b.json
node tools/mechanics-metrics.mjs buildlab-out/a.json buildlab-out/b.json --json
```

With one file the script prints a markdown report. With two files it prints both columns and the delta B - A, with percentages as points. `--json` prints the metrics object, or `{ a, b }` for two files. The header lists each file's options and git revision, and names the options that differ (starter, weapon, shift, theme, pool, policy, proxy). The script refuses a file whose runs have no `merges`, `rerolls` and `sells`. Rerun the build lab to regenerate it. To measure a fresh profile's item pool instead of every item, pass `--pool starting` to both build-lab runs.

| Metric | Definition |
| --- | --- |
| win rate | Share of runs won. The standard error is `sqrt(p (1 - p) / runs)`. |
| average aisle reached | A win counts as 8, as in the summary. |
| deaths by aisle | Each aisle's share of all deaths, and its death rate, which is the deaths there over the runs that reached it. |
| HP lost by aisle | Mean `aisles[].damageTaken` over the aisle's fights. Stockrooms are left out. |
| merges per run | Mean `runs[].merges`. |
| ★2 and ★3 items | Items at that tier in `finalBuild.items` and `finalBuild.shelf`, in total and per run. |
| combos at run end | The mean count of `finalBuild.combos` per run, the number of distinct combos over all runs, and per combo the share of runs that end with it active. |
| sets at run end | Per set, the share of runs whose `finalBuild.sets` level is 2 or more, and the share at level 3. |
| weapons at run end | Mean `weapons` of the last aisle. No shop follows the last aisle, so its cart is the run-end cart. |
| coins at shop entry | Mean `shopLog[].moneyIn` per shop, over the runs that reached that shop. |
| rerolls and sells per run | Mean `runs[].rerolls` and `runs[].sells`. The greedy policy with its default options never rerolls or sells, so both are 0 for it. |

## The greedy policy

A port of `tools/botrun.mjs`'s shop block, with the cart size read from the state instead of the hard-coded 5x4:

1. Repair when `hp < maxHp - 9`. Buy the next Loyalty level when money > 45.
2. Buy every affordable offer (slot order; shelf room and coins are tracked).
3. Merge identical pairs (same type and tier, the shelf copy into the cart copy).
4. For each shelf item, find the best spot in the WHOLE cart (all distinct rotations, every cell), scored by `scoreBuild`; the first best wins. It is placed even when it scores 0. Per combo anchor in the cart (the weapon, or a cart combo's first part): 10 for a combo whose parts all touch it, a replaced one included (so Ray Gun scores above the Nailstorm it grows from), and `10 x 0.5 x` the share of parts in place for a combo not formed yet; plus 1 per module buff on a weapon. The partial credit puts a passive part such as the Magnet next to its weapon before the last part arrives. In `npm run buildlab -- --runs 100 --seed 1 --starter all --weapon all` (1200 runs), about 400 runs end with all three Nailstorm parts in the cart, nearly all of them Nail Gun starts. Nailstorm or Ray Gun had formed in 2 of 403 such runs without the partial credit, and in 401 of 404 with it.
5. Cart upgrade when money > 30, shelf upgrade when money > 25.
6. Merge and place again (the new space and the new tiers).
7. Door: random, but never `rush` when hp < 60% or the aisle just fought is <= 3.
8. Crate and stockroom: the option whose best placement scores highest (first on ties; the first option if none fits).

Differences from botrun: it never rerolls (as botrun's default build), never sells, never upgrades a tier with coins; step 6 is new (botrun placed once, with the old cart size).

## Policies

A policy is `{ name, decideShop(state, view), chooseDoor(doors, state, view), pickCrate(options, state, view), pickStockroom(options, state, view), placeItem(state, item, view) }` (`src/buildlab/policy.ts`). `view = { rng, round }`: the policy's own seeded rng (its only source of randomness) and the call number.

Shop protocol: the lab calls `decideShop(state, view)` again and again with the fresh state. Each call returns the next batch of `ShopAction`s: `buy`, `reroll`, `merge`, `move` (to the grid or the shelf), `rotate`, `upgradeItem`, `upgradeCart`, `upgradeShelf`, `upgradeShop`, `repair`, `sell`, `leave`. The shop ends on `leave`, on `[]`, on a batch where every action failed, or after 64 calls. So a policy never has to guess the outcome of its own earlier actions. `state` must not be mutated.

- `createGreedyPolicy({ itemWeight, placeBonus, score, repairSlack, upgradeShopAbove, upgradeCartAbove, upgradeShelfAbove, rushAvoidHpFrac, rushAvoidUntilWave, maxRerolls })`. `itemWeight(type, tier, state)` <= 0 skips an offer and a higher value buys first; `placeBonus` adds to a placement's or a crate's score.
- Anything more different implements `Policy` directly and reuses the helpers: `bestPlacement(state, probe, weights | scorer)` (the full-cart search for an owned or hypothetical item; a function scores the whole `Build` a spot would give), `scoreBuild`, `mergePairs`.
- Run it: `runBatch({ policy: () => myPolicy, runs, seed, starters, weapons })` returns the whole `Report`; `playRun` one record. A fresh policy is built per run. Give every candidate the same `seed` (common random numbers): the shop rolls, wave plans and combat rng then differ only through the choices.

## The genome (Phase 1b)

`src/buildlab/genome.ts`. A genome is plain JSON, `{ "p": { "item.fan": 1.2, "rule.repairMargin": 9, ... } }`, one number per key of `GENOME_SPEC` (name, bounds, greedy value, integer or not). `genomeFromJSON` fills missing keys with the greedy value, drops unknown ones and clamps to the bounds, so a hand-edited file is always valid.

| keys | meaning |
|---|---|
| `item.<id>` (every `ITEM_ORDER` id) | how much the policy wants the item. 0 = never buy. Orders the buys (best first), what is sold first (lowest), what is placed first. Scaled by `1 + rule.tierBonus * (tier - 1)` |
| `combo.<id>` (every `RECIPE_ORDER` id) | worth of an active combo in the placement score |
| `set.<id>` (every `SET_ORDER` id) | worth of one set level in the placement score |
| `rule.buffWeight` | worth of one module buff on a weapon in the placement score |
| `rule.repairMargin` | repair when hp is more than this below max (hp points) |
| `rule.upgradeShopAbove` / `upgradeCartAbove` / `upgradeShelfAbove` | coins you must have before buying that upgrade |
| `rule.buyReserve` | coins kept back when buying |
| `rule.maxRerolls`, `rerollWant`, `rerollReserve` | reroll while the best offer's item weight is below `rerollWant`, at most `maxRerolls` times per shop, keeping `rerollReserve` coins |
| `rule.sellOn`, `rule.sellMargin` | when the shelf is full, sell the lowest-weight shelf item to buy an offer worth more than it by `sellMargin` (only if `sellOn` is 1) |
| `rule.pickItem` | how much the item weight counts next to the placement score when choosing a crate or stockroom item |
| `door.<kind>` | relative odds of each door kind (the boss door is forced) |
| `rule.rushAvoidHpFrac`, `rushAvoidUntilWave` | skip the Rush door while hp is below that share of max hp, or in aisles up to that number |

Placement scoring is the Phase 1a one: the policy tries every free spot and rotation, computes the real `Build`, and takes the best `Σ combo weight x combo credit + Σ set weights x level + rule.buffWeight x buffs`. The combo credit is the greedy one (`comboCredits`): 1 per formed combo on each anchor, `0.5 x` the share of parts in place for one not formed yet. Crates and stockrooms use the same placement score (plus `rule.pickItem x` the item weight).

**The greedy policy is one genome**: `greedyGenome()` (all item weights 1, combo weights 10, set weights 0, buffWeight 1, tierBonus 0, repairMargin 9, upgrade thresholds 45/30/25, no rerolls, no selling, Rush avoided below 60% hp up to aisle 3). `tests/buildlab/genome.test.ts` plays both over a batch and compares the JSON byte for byte.

## The optimizer

`src/buildlab/evolve.ts`, CLI `npm run buildlab -- evolve [options]` (`--help` lists them: `--pop`, `--gens`, `--seeds-per-eval`, `--starter ID|all`, `--weapon`, `--seed`, `--top-k`, `--held-out`, `--control`, `--shift`, `--theme`, `--pool`, `--out`). Defaults: pop 12, 8 generations, 32 training runs per genome, top 8, 48 held-out runs, 12 random control genomes: about 2 to 3 minutes on a laptop for `--starter all`. `--out PATH` writes `PATH.json` and `PATH.md` (default `buildlab-out/evolve`).

- Search: a seeded (mu + lambda) evolution strategy, mu = max(2, pop/4). Generation 0 is the greedy genome, mutants of it and a few random genomes. Each later generation keeps the mu best (elites, never re-evaluated, so the best fitness cannot drop) and fills the rest with children: a rank-biased elite parent, 25% of the time crossed with a second one (uniform), then Gaussian mutation on the normalized value (`(v - min) / (max - min)`, sigma 0.25 shrinking to 0.08, each parameter hit with probability 0.12, always at least one).
- Fitness of a run: aisles survived, plus up to 0.5 for the kill share of the aisle it died in (a smoother signal than "died in aisle k"); a win scores 8 + 3 + the hp share left. The fitness of a genome is the mean over a FIXED set of (seed, character, weapon) pairs, the same for every genome and generation (common random numbers: differences are the policy's, not luck). Characters and weapons cycle through the pairs.
- After the search: the top K distinct genomes (normalized distance of at least 0.03, so a lineage counts once) are re-run on held-out seeds the search never saw, together with the greedy genome and a control population of random genomes (every parameter uniform in its bounds). The report compares these. Training fitness above held-out fitness is overfitting: the search exploited its 32 seeds. More `--seeds-per-eval` reduces it, at linear cost.
- Deterministic: the same options give the same result (the report's `durationMs` aside).

## Reading the report (`src/buildlab/balance.ts`)

`PATH.md` is for people, `PATH.json` has the same numbers plus the top genomes. The thresholds of every flag are in `BALANCE_CONFIG` (printed in the Items section).

- **Findings** is generated from the flags and numbers below, nothing else. Start there.
- **Held-out results**: win rate and average aisle of the top genomes, the greedy genome and the random control, on the same held-out seeds. If the top is not clearly above greedy and random, the optimizer found little and every other table is noise.
- **Items**: "held" is in the cart at the end of the run. `held top` / `held random` are the shares of the top / control runs holding it, `lift` their ratio, `win held` / `win not held` the win rates of the top runs with and without it, `damage share` the item's weapon damage over the damage dealt in the top runs holding it. *dominant*: held in at least 60% of the top builds, lift at least 1.5, and it does not lower the win rate. *dead*: held in at most 5% of the top builds although random builds hold it at least 5%. Dominant is a hint that the optimizer always wants it; check price and tier first. Dead means even a search aimed at winning leaves it on the shelf.
- **Unmodelled items** (listed in the report and in `UNMODELLED`): the proxy has no player movement, dash or pickup radius, so Bell, Bumper, Running Boot, Energy Drink, Flag, Magnet, Spare Wheel, Tip Jar, Tinfoil Hat and the pickup part of the Vacuum do nothing there. Their rows read "unknown", never "dead". The same holds for the combos in `UNMODELLED_COMBOS` (Express Checkout, Pot Slam, Sugar Rush, Tailwind, Bag It).
- **Combos / Sets**: how often the top builds have them at the end (sets: level 1/2/3), against random builds, and the win rate with and without.
- **Reactions**: how often each element reaction went off, totals over the top runs and per run, for top and random builds. A reaction that never fires is dormant.
- **Starters**: the best win rate and average aisle any top genome reached with each character, and the greedy values.
- **Top 5 final builds**: the best held-out runs of the top genomes (wins first, then furthest aisle, then hp left) with cart, shelf, combos and sets.
- **What the optimizer changed**: the rule parameters of the top genomes against the greedy values.

Caveats: the numbers are only as good as the combat proxy (see its section): a fight is a stationary cart against walking enemies, so range, area and sustain are over- or under-valued in ways the real game's movement would change. A signal that holds across `--seed` values and starters is worth acting on; one that appears in a single run is not. Win rates are low in the proxy, so average aisle is the steadier number. The search is small: it finds big effects, not fine balance.

## Known deviations from the real game

Skipped in `flow.ts`: the profile (unlock recording, loyalty, daily seed, the +20 coin voucher), scoring and the end screens, audio, tutorial events, the Test Lab paths, the overtime after the boss.

Skipped in the arena:

- No player movement or dodging at all (the exposure constants stand in for it), no dash. Items that only act through the dash or shove (Running Boot, Sugar Rush, Express Checkout, Tailwind ...), the move-speed items and the pickup radius do nothing here: expect them to look dead. The Punch Card's dash goal can be drawn but never completes. The goblin stays at `PLAYER_START`.
- Enemy movement is a straight walk: no separation between enemies, no obstacles, no knockback from hits (a hit's `kb` is not applied; only knockback a hook writes to `kx / ky`), no gum puddles, no teleports (Expired Milk is a plain walker), Bananas do not lunge (they are walkers), Gift Cards flee and escape as in the game, eggs explode at the cart (and hurt their neighbours for 12) without credit.
- Hazards (ice, vents, cables, conveyor), aisle events (Wet Floor, Outage, Happy Hour ...), obstacles and props, zones' hazards: none. Zone enemy tilts and the department mix, hp / count / coin multipliers, bread healing and the Electronics electric rate do apply.
- Boss special moves are plain volleys; boss summons spawn through the same group director (real types and counts). The Manager's other kits (Walk-In Freezer slush, Industrial Oven ring ...) are not told apart.
- Pickpocket elites do not absorb coins.
- Enemies arrive fully formed (no 0.3 s spawn grow-in; the boss does not drop in over 1.2 s).
- Coins are all collected (no pickup radius, no sweep loss); coins fall where the player cannot lose them.
- The fixed 0.05 s step differs from the arena's frame step; burn and poison tick on the fake clock exactly as in the game, weapon cooldowns can land up to one step late.
- `fake.rng` draws for affixes and spawn cooldowns follow the arena's order, but the arena draws other things (coin scatter) that the lab does not, so a lab run is NOT a replay of the same seed in the game.
- Items that need enemy attacks as a trigger are only as good as the shots and hits the proxy generates.

## Balance hillclimb (difficulty curve)

Goal: greedy bot, Day Shift, win rate 25-35%, no aisle above 35% deaths among the runs that reached it (aisle 4 at most 25%), later shifts harder. Metric: `npm run buildlab -- --runs 200 --seed S --starter all --shift N` (800 runs per cell), seeds 1 and 2 on Day, seed 1 on Evening and Late. The proxy was not touched. Every step, with its hypothesis and measurements, is in `balance-hillclimb.tsv`.

These numbers, and every row of `balance-hillclimb.tsv`, were measured on the proxy before the fixes in "The combat proxy" (hook-spawned effects, Punch Card, Tough regen) and before the partial combo credit in greedy placement.

Choice: counts and hpScale both fell, because both were growing every aisle. Most of the gain came from dmgScale (what lands on the cart; the proxy's exposure model makes contact damage the main killer) and from counts (more bodies means more contact rolls). The mini-boss lost HP, not damage: its contact hit follows dmgScale. Elite chance was flattened. A bigger tier damage multiplier (1 + 0.75 per tier) was tried twice and reverted: it moved the Day win rate by under one point because the greedy bot rarely tiers weapons. Tiering value is still weak; fix it in the shop or the bot, not here.

| Knob | Before | After |
| --- | --- | --- |
| total, aisles 3-7 | 44 / 55 / 65 / 75 / 86 | 42 / 46 / 52 / 55 / 60 |
| hpScale, aisles 4-7 | 1.8 / 2.3 / 2.9 / 3.6 | 1.5 / 1.7 / 2.0 / 2.3 |
| dmgScale, aisles 1-7 | 1.5 / 1.6 / 1.8 / 2.0 / 2.25 / 2.5 / 2.8 | 1.2 / 1.3 / 1.4 / 1.5 / 1.6 / 1.7 / 1.8 |
| boss aisle escorts hpScale / dmgScale | 2.6 / 2.0 | 2.0 / 1.7 |
| `MINI_BOSS.hp` | 450 | 340 |
| `ELITE.chanceByAisle` (aisles 3-7) | .08 / .12 / .16 / .20 / .25 | .05 / .08 / .11 / .14 / .17 |

Results (greedy bot, all four characters, 200 runs each, seed 1; Day seed 2 in brackets):

| | Before | After |
| --- | --- | --- |
| Day win rate | 1.8% (1.0%) | 26.0% (26.6%) |
| Day deaths a3 / a4 / a5 / a6 / a7 / boss | 6 / 49 / 53 / 67 / 75 / 7 % | 2 / 24 / 16 / 28 / 30 / 17 % |
| Evening win rate | 0.4% | 8.5% |
| Late win rate | 0.0% | 2.1% |

Evening and Late stay harder than Day. The Day win rate sits at the low end of the band and Evening/Late are still very hard (aisle 4 deaths 52% / 69%); the shift multipliers were not touched. The proxy is uncalibrated, so treat these as relative moves.
