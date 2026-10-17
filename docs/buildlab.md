# Build-lab (Phase 1a)

A headless player. It plays whole runs without Phaser: the real run, shop and build rules, a greedy shop policy, and a combat proxy on `FakeCtx` instead of the arena. Seeded, JSON out. The point is Phase 1b: an optimizer that evolves shop policies and reports which items dominate and which are dead. Phase 1a is the harness it will run on.

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
| `--pool all\|starting` | `all` | Which items may appear in shops: every item (like the Test Lab) or a fresh profile's unlocks. |
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
| `tools/buildlab.mjs`, `tools/buildlab.ts` | Launcher and CLI. |
| `tests/buildlab/*.test.ts` | Determinism, full runs, placements, proxy sanity, crates, JSON shape. |

## What a run does

The order of calls is `flow.ts`'s: `createRun` (seed, character, weapon) -> `unlocked` set -> for each aisle: play it -> `finishWave` -> `openShop` -> policy acts -> `leaveShop` -> policy picks a door -> `chooseDoor` -> `startNextWave`. Everything in the shop is the real rules from `state/run.ts` (`buyOffer`, `mergeItems`, `moveItem`, `upgradeCart`, `repair` ...); an action the rules refuse is logged with its reason and skipped.

Randomness, as in the game: `mulberry32(seed)` is `flow.rng` (shop rolls, doors, the wave plan, spawns, kill coins); `combatRng(seed, aisle)` is the weapons' rng (crits, statuses, hook rolls) exactly as the arena creates it; the policy has its own `mulberry32(seed ^ 0x51ed270b)`; the proxy's spots and exposure rolls use a third stream (`combatRng(seed ^ 0x1ab5, aisle)`), so the damage model never shifts a weapon's crit rolls.

Aisle by kind:

- Aisle 1..7: the real `waveSpawnPlan` (mix, count, hp / speed / damage scales, department, modifier, shift), groups scheduled like `ArenaScene.planWave` (same draw order, same ramp, same entries, the 70-enemy cap), elites by `eliteChance` + modifier bonus with the real affixes (swift, tough, splitter, plated; pickpocket only rolls), melon slices, splitter copies. The aisle ends after its 60 s, remaining enemies swept without credit (as `beginCheckout` does).
- Aisle 4 (mini-boss, unless the door was a stockroom): the boss variant is rolled from `flow.rng`, arrives at 8 s with the real `miniBossDef`, summons and volleys; the aisle ends when it dies; `rollMiniCrates` is resolved by the policy (`pickCrate`); the item goes through `takeStockroomItem` (shelf, or coins if the shelf is full).
- Stockroom door: no fight; `rollStockroom` resolved by `pickStockroom`.
- Aisle 8 (boss): the department boss arrives at 1.6 s, six escorts by the plan, the Manager's cycle (volley, charge, summon, special), enrage after 61.6 s. Killing it is the win. Overtime after the boss is not played.

## The combat proxy

Real, not modelled: the weapon patterns (`FakeArsenal` runs every pattern), item and combo and set hooks, the damage pipeline (crit, affinity, mark, armor, Shred, Wet, statuses, burn and poison ticks driven here every step, reactions), kill coins (`killCoins`, `giftcardCoins`, `killCoinMult`, the 0.4 drop chance), `build.regen`, bread, honey healing (`healTargets`), the Sanitizer's cleanse (`cleanseAura`), Weaken on enemy damage (`weakenedDamage`), the player hit path (`FakeCtx.hurt`: i-frames, `onPlayerHit` hooks such as Bubble Wrap), the damage breakdown (`systems/damageStats`, including reaction counts).

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

A regular aisle always lasts its full 60 s (that is the game's rule), so `clearTime` is `null` whenever the cart cannot clear the aisle in time; use `leftover` and `dps` to rank builds then. `playAisle(..., { mode: 'clear' })` runs on until everything is dead (at most 30 s extra) when you want a time-to-clear.

## The output

```
{ meta:    { seed, runs, starter, weapon, shift, theme, pool, policy, proxy, gitRev?, durationMs },
  runs:    [{ seed, starter, weapon, shift, theme, result: 'win'|'dead', diedAt?, cause?, aislesPlayed, kills, coinsEarned,
              aisles: [...], acquired: [{item, tier, from}], finalBuild: { items: [{id, tier, x, y, rot}], shelf, combos, sets, cartSize, maxHp },
              shopLog: [{ shop, hp, moneyIn, moneyOut, shopLevel, offers, steps: [{kind, ok, item?, tier?, cost?, reason?}], door }] }],
  summary: { runs, winRate, avgAisleReached, itemPickRate, itemFinalRate, itemWinRate, comboRate, comboWinRate, setRate,
             reactionTotals, avgDpsByAisle, avgDamageTakenByAisle, deathsByAisle, byStarter } }
```

`itemPickRate` is the share of runs that ever held the item (starter, buys, crates, stockrooms); `itemFinalRate` the share that had it in the cart at the end; `itemWinRate` the win rate among those runs (the dominance signal); `comboRate` / `setRate` the share of runs where it was active at the start of at least one fight (sets: per level 1 to 3). `avgAisleReached` counts a win as 8.

## The greedy policy

A port of `tools/botrun.mjs`'s shop block, with the cart size read from the state instead of the hard-coded 5x4:

1. Repair when `hp < maxHp - 9`. Buy the next Loyalty level when money > 45.
2. Buy every affordable offer (slot order; shelf room and coins are tracked).
3. Merge identical pairs (same type and tier, the shelf copy into the cart copy).
4. For each shelf item, find the best spot in the WHOLE cart (all distinct rotations, every cell), scored `active combos x 10 + module buffs on weapons`; the first best wins. It is placed even when it scores 0.
5. Cart upgrade when money > 30, shelf upgrade when money > 25.
6. Merge and place again (the new space and the new tiers).
7. Door: random, but never `rush` when hp < 60% or the aisle just fought is <= 3.
8. Crate and stockroom: the option whose best placement scores highest (first on ties; the first option if none fits).

Differences from botrun: it never rerolls (as botrun's default build), never sells, never upgrades a tier with coins; step 6 is new (botrun placed once, with the old cart size).

## Policies and Phase 1b

A policy is `{ name, decideShop(state, view), chooseDoor(doors, state, view), pickCrate(options, state, view), pickStockroom(options, state, view), placeItem(state, item, view) }` (`src/buildlab/policy.ts`). `view = { rng, round }`: the policy's own seeded rng (its only source of randomness) and the call number.

Shop protocol: the lab calls `decideShop(state, view)` again and again with the fresh state. Each call returns the next batch of `ShopAction`s: `buy`, `reroll`, `merge`, `move` (to the grid or the shelf), `rotate`, `upgradeItem`, `upgradeCart`, `upgradeShelf`, `upgradeShop`, `repair`, `sell`, `leave`. The shop ends on `leave`, on `[]`, on a batch where every action failed, or after 64 calls. So a policy never has to guess the outcome of its own earlier actions. `state` must not be mutated.

Plugging in a parameterized policy (Phase 1b):

- `createGreedyPolicy({ itemWeight, placeBonus, score, repairSlack, upgradeShopAbove, upgradeCartAbove, upgradeShelfAbove, rushAvoidHpFrac, rushAvoidUntilWave, maxRerolls })`. `itemWeight(type, tier, state)` <= 0 skips an offer and a higher value buys first; `placeBonus` adds to a placement's or a crate's score. A genome of per-item weights is one `itemWeight` closure.
- Anything more different implements `Policy` directly and reuses the helpers: `bestPlacement(state, probe, weights)` (the full-cart search for an owned or hypothetical item), `scoreBuild`, `mergePairs`.
- Run it: `runBatch({ policy: () => myPolicy(genome), runs, seed, starters, weapons })` returns the whole `Report`; `playRun` one record. A fresh policy is built per run. For common random numbers across genomes, give every candidate the same `seed`: the shop rolls, wave plans and combat rng then differ only through the choices.
- Fitness candidates: `summary.avgAisleReached`, `summary.winRate`, or a mix of `dps` and `leftover` per aisle (smoother than win rate, which is noisy at low rates). Dominance reports come from `itemWinRate` / `itemFinalRate` / `comboRate` over many genomes.

## Known deviations from the real game

Skipped in `flow.ts`: the profile (unlock recording, loyalty, daily seed, the +20 coin voucher), scoring and the end screens, audio, tutorial events, the Test Lab paths, the overtime after the boss.

Skipped in the arena:

- No player movement or dodging at all (the exposure constants stand in for it), no dash. Items that only act through the dash or shove (Running Boot, Sugar Rush, Express Checkout, Tailwind ...), the move-speed items and the pickup radius do nothing here: expect them to look dead. The goblin stays at `PLAYER_START`.
- Enemy movement is a straight walk: no separation between enemies, no obstacles, no knockback from hits (a hit's `kb` is not applied; only knockback a hook writes to `kx / ky`), no gum puddles, no teleports (Expired Milk is a plain walker), Bananas do not lunge (they are walkers), Gift Cards flee and escape as in the game, eggs explode at the cart (and hurt their neighbours for 12) without credit.
- Hazards (ice, vents, cables, conveyor), aisle events (Wet Floor, Outage, Happy Hour ...), obstacles and props, zones' hazards: none. Zone enemy tilts and the department mix, hp / count / coin multipliers, bread healing and the Electronics electric rate do apply.
- Boss special moves are plain volleys; boss summons spawn through the same group director (real types and counts). The Manager's other kits (Walk-In Freezer slush, Industrial Oven ring ...) are not told apart.
- Pickpocket elites do not absorb coins; the Tough affix regenerates after 2 s without damage (HP delta based, not `lastHitT`).
- Enemies arrive fully formed (no 0.3 s spawn grow-in; the boss does not drop in over 1.2 s).
- Coins are all collected (no pickup radius, no sweep loss); coins fall where the player cannot lose them.
- The fixed 0.05 s step differs from the arena's frame step; burn and poison tick on the fake clock exactly as in the game, weapon cooldowns can land up to one step late.
- `fake.rng` draws for affixes and spawn cooldowns follow the arena's order, but the arena draws other things (coin scatter) that the lab does not, so a lab run is NOT a replay of the same seed in the game.
- Items that need enemy attacks as a trigger are only as good as the shots and hits the proxy generates.
