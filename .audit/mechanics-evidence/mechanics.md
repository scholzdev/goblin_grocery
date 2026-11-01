# Mechanics audit: Goblin Grocery

Area: game design critique of the mechanics (core loop, build diversity, pacing, economy, readability, meta). Read-only. No code was changed. A throwaway experiment test (`tests/_audit/mechanics-exp.test.ts`) was written, run once and deleted.

## How to read the numbers

Every number carries one of three labels.

- **Structural.** It comes from the rules and the shop rolls alone, so it holds no matter how the bot fights. Examples are offer odds, merge counts and combo-part availability.
- **Proxy.** It comes from the build lab's combat proxy. The cart stands still, a fixed hit chance stands in for dodging, and about 10 movement and pickup items do nothing (docs/buildlab.md, "The combat proxy"). Compare these numbers with each other, never as real win rates.
- **Judgment.** My design opinion, with the reasoning given.

### Runs behind the evidence

All files are in `scratchpad/bl/`.

| File | What | Size |
|---|---|---|
| `greedy1.json` | greedy policy, all 4 characters x 3 weapons, full item pool, seed 1 | 600 runs |
| `greedy_start.json` | the same seeds, but only the 18 items a fresh profile has | 600 runs |
| `exp.json` | six policy variants on the same seed 11 (paired, common random numbers) | 300 runs each |
| `evo1.md` / `evo2.md` | `buildlab evolve`, all characters and weapons, seeds 1 and 2 | defaults |

### Noise

At n=300 the standard error of a win rate is about 2.7 points. At n=600 it is about 1.8 points.

The greedy win rate moves with the seed. It was 25.8% on seed 1, 33.7% on seed 11, and 13% on 48 held-out runs in evo2. In evo1 the evolved genomes did not beat greedy (29% vs 33%). By the doc's own rule, evo1's dominant and dead flags are therefore noise. The dead items also disagree between the two seeds (multipack in evo1, piggy in evo2). The only cross-seed evolve signal is that Kitchen and Heat sets are over-held. That is inflated too, because 2 of the 3 starting weapons are Kitchen + Heat.

### A lab artifact that matters

Greedy placement places one shelf item at a time and scores combos and module buffs only. A passive combo part therefore scores 0 until the last part lands, and it goes to the first free cell.

**Nailstorm formed in 0 of the 201 runs that owned Nail Gun, Magnet and Battery** (Magnet is a passive). Toast Mode formed in 180 of 180 runs that owned its parts, where every part is a weapon or a module.

So the Nail Gun's 15.5% greedy win rate (vs Pan 38%, Toaster 24%) is at least partly an artifact. The same goes for "never formed" lists that contain combos with passive parts. These include tvDinner, clearanceSale, sparksFly, sourMist and rayGun. I report it under Out of scope leads.

---

## 1. Core loop: are the fight, shop and cart decisions interesting?

**Shop 1 is decided before the player looks at it (structural).** `STARTER_WEAPONS.guarantee` (`src/data/items.ts:78-82`) puts the weapon's two combo parts into shop 1. The player arrives with about 26 coins (greedy1: shop 1 moneyIn 25.9), and the two parts cost about 20.
- Toast Mode formed in 180 of 180 runs that owned its parts.
- Express Checkout formed in 205 of 209.
- Together they are the two most common combos in the whole game (34% and 30% of all runs, against at most 8% for any other).
- The run's identity is set by the weapon pick on the title screen, not by a shop decision.

**Placement is shallow in the starting 4x4 cart.** The cart starts at 4x4 (`src/state/run.ts:57`). Its centre cells touch almost everything, so "weapon in the middle, everything else around it" is close to optimal every time.
- **Proxy, paired, seed 11.** A policy that ignores combos and buffs when placing (it puts each item in the first free cell) wins 25.7%, against 33.7% for greedy. That gap is about 3 SE, so placement is worth something but not much.
- **Proxy.** Toast Mode still formed in 29% of those runs, as often as with the scoring placement, because first-fit lands next to a centred Toaster anyway.
- **Structural.** The Bundle Deal (+6% per distinct neighbour type, `src/data/items.ts:93`) rewards the same "pack around the weapon" answer.
- **Judgment.** In the opening shops the cart is a fit puzzle, not a placement decision. Placement starts to matter only after cart upgrades. Greedy rarely buys them (83% of greedy1 runs end at 4x4). Both evolve seeds lowered `upgradeCartAbove` (median 26 and 17.5, against 30), a mild hint that space is valuable.

**Buying is breadth-first, and that is right (proxy, paired).**
- "Only buy weapons" falls to 6.3%, so the support layer clearly matters.
- "Weapons first" (35.0%) and greedy (33.7%) are within noise.
- Among runs that reached aisle 5, weapons owned at that point line up with winning: 1 weapon 18%, 2 weapons 36%, 3 weapons 41%, 4 weapons 56% (greedy1). That is not a clean causal number, because of survivorship. Still, the decision "another weapon or another module" is real and reads well.

**The door decision has little to work with (proxy + judgment).**
- HP before an aisle averages 37 to 44 in every aisle (greedy1: auto repair 6 between aisles plus the 10 HP repair).
- Deaths happen from near-full HP inside one aisle: 323 of 444 deaths started that aisle at 30 HP or more.
- The run is a string of independent checks, not a resource you manage across aisles.
- Rush and Quiet trade coins against danger. You choose without seeing what the aisle holds (roster, elite affix). So the choice turns on HP, and HP is almost always full.
- Proxy caveat: humans dodge, and the proxy's exposure constants are uncalibrated.

**Dead or near-dead decisions, judgment, ranked by how often they come up:**
1. Shop 1 (above).
2. Saving coins (see section 4).
3. Rerolling. Neither evolve seed ever chose a reroll (`rule.maxRerolls` median 0 on both seeds). `rerolls2` scored 28.3% against 33.7%, worse but within about 2 SE.
4. Selling. `rule.sellOn` was 0 on both seeds.

---

## 2. Build diversity

### The full pool is too big for a 7-shop run (structural, the main finding)

64 items share 4 offer slots per shop, about 28 offers per run. `weight()` (`src/systems/shop.ts:35-39`) gives:
- 2.2 to combo partners of owned items,
- 1.8 to "enhancers",
- 1.6 to an owned weapon type (1.3 for any other weapon),
- **no duplicate bonus at all to owned non-weapons**, and one shop never offers the same type twice.

Run on the same seeds, the full pool against the starting pool (18 items) gives:

| Measure | Full pool (64) | Starting pool (18) | Label |
|---|---|---|---|
| merges per run | 0.95 | 3.48 | structural (shop rolls and greedy merges every pair) |
| ★3 items at run end | 10 of 5,581 | 188 of 5,665 | structural |
| combos active at end, per run | 1.25 | 2.00 | mostly structural |
| distinct combos seen | 26 | 10 | structural |
| greedy win rate | 25.8% | 43.0% | proxy, inflated by ~10 movement items that are dead in the proxy and only dilute the full pool |

**Combo parts are rarely even offered (structural).** These are runs that reached shop 7, so they saw all 7 shops plus the aisle-4 crates, with the full pool:
- the 2-part combos' parts all appeared in 14 to 57% of runs,
- the 3- and 4-part combos (sourMist, tvDinner, clearanceSale, rayGun, thunderstorm, tailwind, sparksFly, bagIt) in 4 to 11%.

With the starting pool, the 10 reachable combos show up in 60 to 87% of runs.

So every unlock makes a given build less likely. The game gets **less coherent as the player progresses**. The merge rule (★1 + ★1 → ★2) was a pillar of the original brief (`Goblin_Grocery_Opus_Prompt.md` §6 and the README's "Upgrades and synergy"). It is close to vestigial at 64 items.

### The tier payoff is weak, and the coin-upgrade path is dead

- **Structural.** A ★2 weapon costs 2 copies and deals 1.5x damage at 0.9x cooldown, about 1.67x DPS. ★3 costs 4 copies for about 2.5x DPS (`src/engine/define.ts:80-81`). Four separate ★1 copies give 4x DPS, if you have the cells.
- **Proxy.** The hillclimb tried a bigger tier multiplier twice. It moved the Day win rate by under 1 point both times (`docs/balance-hillclimb.tsv` rows 3 and 10).
- **Proxy, paired.** An "upgrade weapons in place first" policy reached 34.3%, against 33.7% for greedy. It built 497 ★3 items against 5, and the win rate did not move.
- **Confirmed in code.** `upgradeItem` (`src/state/run.ts:241`) has no UI caller. `src/ui/shop.ts:445` says combine is "the only way to level up". Only `src/bot/bot.ts:389` and the build lab call it. Players cannot buy a tier with coins. The browser bot can, so botrun balance numbers model an action players do not have.

### Sets: uniform thresholds on very different set sizes (structural + proxy)

`SET_THRESHOLDS = [2, 3, 4]` applies to every set (`src/engine/define.ts:84`). Members per set (counted from `src/content/items/*.ts`):

| Set | Members |
|---|---|
| Checkout | 16 |
| Snacks | 15 |
| Kitchen | 14 |
| Tools | 13 |
| Blast | 9 |
| Heat | 7 |
| Cleaning | 6 |
| Frost | 6 (plus Jelly Beans) |

Share of top builds reaching level 2 (evo1, the share that reached level 3 in brackets):

| Set | Level 2 (L3) |
|---|---|
| Kitchen | 53% (28%) |
| Tools | 52% (27%) |
| Snacks | 31% (20%) |
| Checkout | 27% (18%) |
| Heat | 25% (3.1%) |
| Blast | 13% (1.8%) |
| Electric | 7.0% (0.3%) |
| Frost | 3.6% (0.8%) |
| Cleaning | 3.4% (0.5%) |

Cleaning and Frost level 3 is content almost nobody sees. That includes the handoff's L3 tuning (`handoff.md`, Set level 3 table).

### Dominant and trap items: weak evidence, reported honestly

- **Dominance.** No item passed the dominance threshold on either evolve seed. Kitchen and Heat are over-held, partly because the starting weapons are Kitchen + Heat.
- **Pan vs Toaster vs Nail Gun.** Pan's greedy win rate is highest (38% vs 24% and 15.5%, proxy). The stationary proxy cart likely favours melee, and Nail Gun's number is hit by the Magnet placement artifact. Two structural points hold anyway:
  - Pan is the cheapest weapon (10 coins) with a 150° multi-target sweep (9 dmg / 1.15 s).
  - Nail Gun's 3-damage nails lose 70% of each hit to armor 3, the armor of Canned Beans, Plated elites and the Checkout boss (`src/content/enemies/beans.ts:4-9`, `src/data/enemies.ts:138`). Can Opener / Crack Open is the answer, if it shows up.
- **Vacuum as a weapon (structural + judgment).**
  - It does 2 damage every 0.65 s in a 150 px radius, about 3 dps, from a 4-cell T shape at 18 coins.
  - That is the lowest damage per coin and per cell of any weapon. Toaster does 9 per 1.0 s for 12 coins in 2 cells.
  - Its real value is coin pickup and the Full Suck active, which the proxy cannot see.
  - Bought for damage, it is a trap. Its shop card should sell it as a utility item.
- **Economy passives (judgment, estimated from greedy1 aisle coins).** Piggy Bank is one of 8 or so economy passives (piggy, coupon, tipjar, scratchticket, punchcard, barter, binder, expiredcoupon).
  - Its +15% applies to kill coins only: roughly 19 / 35 / 41 / 48 per aisle in aisles 4-7 (proxy coins, all collected).
  - Bought around shop 3 for about 12 coins, it returns about 21 coins over four aisles and takes a cell. Evo2 flagged it dead.
  - In a 7-shop run, an economy item bought after shop 3 rarely pays back.

---

## 3. Difficulty and pacing

**The curve (proxy, greedy1).** Death rate among runs that reached each aisle, and damage taken there:

| Aisle | 1 | 2 | 3 | 4 | 5 | 6 | 7 | boss |
|---|---|---|---|---|---|---|---|---|
| Deaths | 0% | 0% | 2% | 28% | 20% | 23% | 23% | 23% |
| Damage taken (HP) | 2.2 | 0.7 | 9.0 | 18.1 | 18.2 | 24.1 | 27.9 | 26.5 |

- **Aisles 1 and 2 have no threat at all.** Aisle 1 is 30 Sour Milk over 60 s (`src/data/waves.ts:7`). The hillclimb lowered their dmgScale further, 1.5 → 1.2 and 1.6 → 1.3 (`balance-hillclimb.tsv` row 12). The recorded DPS of 9-10 there is capped by enemy supply, not by the build (leftover 0.5 in aisle 2). These are two minutes in which nothing can go wrong. The original brief had 35 s waves and a 7-10 min run (`Goblin_Grocery_Opus_Prompt.md` §2). At 60 s a full run is about 8 minutes of combat plus 7 shops.
- **Aisle 4 is the cliff.** 163 of 444 deaths (37%) happen there. The mini-boss arrives at 8 s, and the roster jumps by spitters, turkeys, cereal and expired milk at once (`src/data/waves.ts:10`). The mini-boss aisle ends after 36 s on average, so its deaths come fast.
- **From aisle 5 on, the curve is flat at about 20-23% per aisle.** The run is a geometric survival test. Each later aisle is about as likely to end the run as the last.
- **The boss** kills 23% of runs that reach it, after about 40 s on average (proxy). That part reads fine.

**What the hillclimb did.** It raised the Day win rate from 1.8% to 26% (proxy), mostly through dmgScale and enemy counts (`docs/buildlab.md`, "Balance hillclimb").
- It tuned against a bot that never moves, with exposure constants the doc calls "NOT calibrated against human play". Its absolute target (25-35%) says little about humans. A dodging human may find the new curve much easier, which would make aisles 1-4 even emptier.
- It did not touch the shifts. Evening falls to 8.5% and Late to 2.1% (row 12). The step from Day to Evening is a 3x drop, a steep first rung on the replay ladder.

**Where runs are won or lost (judgment from the above).**
- **Lost:** in one aisle from full HP, mostly aisle 4, or when DPS stops keeping up from aisle 5 (leftover enemies rise 10.6 → 14.6 over aisles 5-7).
- **Won:** by having 3+ weapons by aisle 5. In practice that depends on the shop offering them. Combos and tiers matter less than the design intends.

---

## 4. Economy

**Income and prices (greedy1).** Coins at shop entry go from 26 in shop 1 to 77 in shop 7. Aisle income goes from 11 to 60. The average offer price goes from 9.4 to 24.4, so inflation (+10% per shop) and the tier mix keep roughly 2-3 buys per shop.

**Saving is never right (structural + proxy).**
- Inflation punishes held coins at 10% per shop.
- Interest exists only at Checkout set level 2 or higher, +1 per 10 coins held, capped at 5 (`src/state/run.ts:392`, `src/content/sets/checkout.ts:8`). Holding 50 coins for one shop loses about 5 to inflation and earns at most 5. That is break-even at best, and only with a specific set.
- Both evolve seeds settled on `rule.buyReserve` = 0, `maxRerolls` = 0 and `sellOn` = 0. The optimizer never found a reason to save, reroll or sell.
- Exception: saving up for a cart upgrade (15/25/40/60) or the Loyalty Card (20/35/55).

**Rerolls.** They cost (1 + ceil(shop / 2)) x (n + 1) (`src/systems/shop.ts:15`), so 2, 4, 6 in shop 1 and 5, 10, 15 in shop 7. In a 59-item pool one reroll rarely hits a wanted part. A 2-part combo partner shows up in a given shop about 10% of the time (rough estimate from the weights: 4 slots x 2.2 / ~77 total weight). Rerolling is a weak lever, which is why the optimizer skips it.

**Selling.** It pays 50% (`src/systems/shop.ts:13-14`) with no reason to sell other than space. Barter Stamp and Collector's Binder (shipped from the plan) exist to make selling a build, but they are two more items diluting the pool.

**Double pack.** 8% per offer from shop 2, x1.5 price, counts 2 in its family set (`src/data/waves.ts:74-75`). With 3-4 non-legendary offers per shop that is about one double pack every 3-4 shops. It is a pleasant surprise, not a strategy. Judgment: fine as is.

**Shop lock (shipped from the plan).** Locking is free and freezes prices against inflation (`src/state/run.ts:371-375`). Locking offers you can't afford yet is a cheap hedge. It is the only real way to "save" in the game, and it saves an offer, not coins. Judgment: keep it. It is the right shape for a saving decision.

---

## 5. Readability

**The player cannot see what killed them (confirmed in code).**
- `hurtPlayer(dmg)` (`src/scenes/ArenaScene.ts:962`) takes no source, so neither the run state nor the end screen knows the attacker.
- The end receipt shows a detailed damage-dealt breakdown (`src/ui/ui.ts:546`, `damageBreakdownHtml`) and nothing about damage taken.
- Since runs die from full HP in one aisle, "what hit me" is the main lesson a player needs, and it is missing.

**Too many systems running at once (judgment).** A single shop card can involve:
- module adjacency buffs,
- the Bundle Deal,
- up to 38 combos,
- 9 sets x 3 levels (cart-wide, non-adjacent, with each item in 1-3 sets),
- double packs,
- 6 element reactions,
- tiers,
- perishables (age),
- Jelly Bean flavors,
- Q/E/F actives.

On the fight side add 5 elite affixes, 5 hazards, door modifiers, special rooms, set events, zones and Punch Card goals. Each one is reasonable on its own, but no layer is introduced on its own.

Sets (count anywhere) and adjacency (count neighbours) pull placement in different directions. The player cannot easily tell which one moved a number. The shop's combo panel and set-gain previews (`src/ui/shop.ts:171-253`) are good. The problem is how much there is, not how it is shown.

**Combos with passive parts are easy to get wrong.** Nailstorm needs Magnet (a passive) to touch the Nail Gun. The lab bot failed this 201 of 201 times. A human could miss it too, because passives otherwise work from anywhere in the cart. Judgment: drag-time highlights for "this passive is part of a combo with that weapon" would catch it.

**What an enemy is about to do.** This looks covered: telegraphs on baguette, banana, egg and boss moves, plus elite crowns, auras and affix names (README; `handoff.md`, Elite affixes). The visual agent is better placed to judge it.

---

## 6. Meta-progression and replay

**Unlocks dilute (structural, section 2).** 46 unlocks (`src/data/unlocks.ts`) grow the shop pool from 18 to 63 items. Each one makes every specific combo rarer. The meta loop rewards playing with a less coherent game.

**Unlock conditions are mostly passive milestones.** Reach aisle N, lifetime kills or coins, runs finished, losses. Only "discover N combos" and "clear N aisles of theme X" push the player to play differently. Judgment: few unlocks ask for a new way of playing.

**Replay reasons that work** (judgment):
- 5 themes, each with its own boss kit and hazard (`docs/departments.md`),
- the shift ladder per character,
- the daily run,
- the "Almost there" bars on the end screen (`handoff.md`, Run-End-Unlocks),
- the catalog's `?` combo slots.

**Weak spots** (judgment):
- Characters differ by stats plus one small signature (`src/data/items.ts:54-74`).
- The weapon pick decides the run's combo through the shop-1 guarantee.
- The first shift step (26% → 8.5%) is steep.

---

## 7. Ranked proposals

Cost: S = under a day, M = a few days, L = a week or more. "Plan overlap" refers to `docs/new-items-plan.md`. Almost everything in that plan has already shipped (PR #9, merge `7602d76`): shop lock, perishables, actives, growing items, weight, cursed items, Punch Card, Shortcut Key, goblin signatures, Ice Sheet / Detonate, Snow Cone, Moldy Bread, Barter, Binder. None of the proposals below re-proposes a plan item.

### 1. A per-run stock: a fixed shop pool size per run

- **Problem.** Unlocks dilute the pool. Merges, tiers and combos collapse at 64 items (section 2: 0.95 vs 3.48 merges per run, 1.25 vs 2.0 combos per run).
- **Change.** At run start, draw the run's stock of about 22-26 items:
  - the theme's bias items,
  - 2-3 "featured families" from the run seed,
  - the starting weapon's combo partners,
  - one random legendary.
  
  Show the featured families on the route or start screen. Unlocks then add variety *between* runs and leave the odds *within* a run alone. The daily run gets a named stock for free.
- **Cost.** M. Files: `src/state/run.ts` (createRun: roll and store the stock), `src/systems/shop.ts:63-65` (pool filter), `src/types.ts` (RunState), a start or route screen line in `src/ui/`.
- **Risk.** Less surprise per run. Pick the stock size with `npm run buildlab -- --pool` style variants. It needs a pool option that takes an explicit list.
- **Plan overlap.** None.

### 2. Make duplicates findable

- **Problem.** The merge pillar is starved: ★3 appears 10 times in 600 runs, and owned non-weapons get no duplicate weight (`src/systems/shop.ts:35-39`).
- **Change.** Owned types (any kind, below ★3) get weight ~2.5. From shop 3, one offer slot is a "Restock": a copy of an owned item at the normal inflated price, marked so the player sees a combine coming. Alternative: expose the existing `upgradeItem` (`src/state/run.ts:241`) as a "Restock" button on cart items at inflated price.
- **Cost.** S. Files: `src/systems/shop.ts` (weight, rollOffers), plus `src/ui/shop.ts` for the badge or button.
- **Risk.** Builds converge on stacking. Pair it with proposal 3 so stacking is a choice, not the default.
- **Plan overlap.** None.

### 3. Give tiers a qualitative payoff

- **Problem.** Linear tier stats don't move outcomes. Hillclimb rows 3 and 10 changed nothing, and the upgradeFirst policy was flat at 34.3% vs 33.7% with 497 ★3 items.
- **Change.** Each weapon gains one behaviour at ★3 (and optionally ★2): Toaster +1 toast, Pan full 360° sweep, Nail Gun +1 pierce, Vacuum doubled pickup radius, and so on. Data per weapon in its content file.
- **Cost.** M. Files: `src/content/items/<weapon>.ts` (14 weapons), `src/engine/define.ts` (`weaponTiers`), shop card rows.
- **Risk.** Content work and balance. Spikes are possible with Gold Star's ★4.
- **Plan overlap.** None.

### 4. Turn shop 1 into a pick

- **Problem.** The shop-1 guarantee hands out the starting combo (Toast Mode 180/180, Express Checkout 205/209). The weapon pick decides the run.
- **Change.** Shop 1 offers one part of 2-3 *different* combos for the starting weapon, for example Toaster → Fan (Toast Mode), Hot Sauce (Five Alarm), Sourdough (Fresh Bread), plus 1 random. The player commits to a direction.
- **Cost.** S. Files: `src/data/items.ts:78-82` (`guarantee` as a list of candidates), `src/systems/shop.ts:61`.
- **Risk.** A weaker aisle 2-3 for new players. Check aisle-4 deaths in the lab.
- **Plan overlap.** None.

### 5. Reshape the curve: shorter opening, softer aisle-4 cliff

- **Problem.** Aisles 1-2 have 0% deaths and about 1-2 HP taken. Aisle 4 holds 37% of all deaths.
- **Change.** Aisles 1-2 last 35-40 s (the original brief's length) with slightly higher counts per second. Spread aisle 4's new enemy types over aisles 3-5 so the mini-boss is the only new thing in aisle 4. Then retune the shifts so Evening sits nearer 15% than 8.5% on the bot.
- **Cost.** S for data, M with re-running the hillclimb. Files: `src/data/waves.ts:7-14`, `docs/balance-hillclimb.tsv`.
- **Risk.** The proxy is uncalibrated. Before trusting new targets, calibrate `PROXY.exposure` against one recorded human run (botrun or the real game).
- **Plan overlap.** None.

### 6. A death recap

- **Problem.** The player cannot tell what killed them.
- **Change.** `hurtPlayer(dmg, source)` with sources for contact by enemy type, attack, projectile, hazard, event, boss move and Ghost Pepper burn. Record damage taken by source in `stats.damage`. On defeat, show "Wiped out by: Baguette swipe (Elite, Swift)" plus the top 3 damage-taken sources on the receipt.
- **Cost.** S-M. Files: `src/scenes/ArenaScene.ts:962` and its roughly 10 callers, `src/systems/damageStats.ts`, `src/ui/ui.ts:546`, i18n.
- **Risk.** Low.
- **Plan overlap.** None.

### 7. Set thresholds that fit the set's size, or count tiers

- **Problem.** Uniform 2/3/4 thresholds make Cleaning and Frost level 2-3 near unreachable (3.4-3.6% of top builds at level 2).
- **Change.** Choose one of two options.
  - Per-set thresholds: small sets reach level 3 at 3 distinct types.
  - Set count = the sum of tiers. A ★2 counts 2, like the double pack already does. This also gives merging a second reason to exist (proposal 2).
- **Cost.** S. Files: `src/data/sets.ts:23-50` (`setCount`, `setLevels`, `setGains`), `src/engine/define.ts:84`, set texts.
- **Risk.** Sets get stronger overall. Re-check Kitchen and Heat, which are already the most held.
- **Plan overlap.** None. It builds on the shipped double-pack rule.

### 8. Make holding coins a choice

- **Problem.** The optimizer never saves (`buyReserve` 0 on both seeds). Interest is Checkout-only and capped at 5, while inflation costs 10% per shop.
- **Change.** Base interest for everyone, +1 per 10 held, capped at 3, with the Checkout set raising the cap to 6 and then 10. Show "interest next aisle: +N" in the shop footer. Optionally drop inflation to 6% per shop.
- **Cost.** S. Files: `src/state/run.ts:392`, `src/content/sets/checkout.ts:8`, `src/data/waves.ts:70` (inflationPerShop), shop footer UI.
- **Risk.** Snowballing in Overtime. Keep the cap low.
- **Plan overlap.** It builds on the shipped shop lock, Barter Stamp and Binder.

### 9. Doors that show what is behind them

- **Problem.** The door choice is made blind, and HP is almost always full, so Rush/Quiet/Event are mostly coin choices.
- **Change.** Each door card lists the aisle's 2-3 most common enemy types (already computed by `waveSpawnPlan`), the elite affix if one is forced, and the hazard intensity. The choice becomes "Rush against spitters with my melee build?" instead of a coin flip.
- **Cost.** S-M. Files: `src/systems/shop.ts:81-125` (rollZones, rollDoors), the route UI in `src/ui/`.
- **Risk.** Low. More text on the route screen.
- **Plan overlap.** None. The Shortcut door is already shipped.

### 10. Placement depth through directional modules

- **Problem.** In a 4x4 cart adjacency is nearly free. Ignoring placement costs about 8 points (proxy, paired), and the Bundle Deal rewards the same pack-around-the-weapon answer.
- **Change.** Make 3-4 existing modules directional: Fan, Fuel Can, and Battery as a "plug" side. They buff only along their facing, so R-rotate matters. Optionally cap the Bundle Deal at 3 neighbours.
- **Cost.** M. Files: `src/systems/synergies.ts` (computeBuild touching), those modules' content files, drag preview in `src/ui/shop.ts`.
- **Risk.** It adds a rule to an already crowded system (section 5). Do it only together with proposal 11.
- **Plan overlap.** None.

### 11. Introduce systems one at a time

- **Problem.** About 10 build layers are visible from the first shop.
- **Change.**
  - Hide set chips and the set panel until the player owns 2 items of one set.
  - Introduce reactions through the first reaction that fires, with a one-time card.
  - Leave Q/E/F active slots out of the HUD until an active is owned.
  - Keep a "what changed" diff line under the build stats after every drag.
- **Cost.** M. Files: `src/ui/shop.ts`, `src/ui/hud.ts`, tutorial flags in the profile.
- **Risk.** Low. Mostly UI gating.
- **Plan overlap.** None.

### 12. Unlocks that ask for a new way to play

- **Problem.** Most unlocks are passive milestones, and each one dilutes the pool.
- **Change.** Replace a third of the milestone conditions with build goals. Examples: "win with Frost level 2" unlocks the Snow Cone; "trigger 10 Detonates in one run" unlocks Moldy Bread; "kill the mini-boss with only melee weapons" unlocks the Leaf Blower. With proposal 1, a new unlock can be "featured" in the next run's stock so the player meets it right away.
- **Cost.** S. Files: `src/data/unlocks.ts`, `src/state/profile.ts` (new per-run stats), i18n.
- **Risk.** Some goals can feel grindy. Keep them achievable within a normal run.
- **Plan overlap.** None.

**Order.** I rank 1, 2 and 4 first, because they fix the structural problem that run coherence falls as content grows. Proposals 6 and 5 follow as the cheapest wins for player understanding and pacing.

---

## Out of scope leads

- **The build lab places passive combo parts blindly.** Nailstorm formed in 0 of 201 runs that owned its parts. `bestPlacement` scores `scoreBuild` (`src/buildlab/policy.ts:67`), which counts only combos and buffs, and items are placed one by one. Every combo and item flag involving a passive part, and the Nail Gun's weapon ranking, is suspect until placement looks ahead or scores "combo parts touching".
- **`src/bot/bot.ts:389` calls `upgradeItem`**, which players cannot do in the UI (`src/ui/shop.ts:445`). Botrun balance runs model a stronger tiering path than the game offers.
- **The README content section is stale.** It says "Items (31)" and "Combos (10)". The game has 64 shop items (65 content files including the spent key) and 38 combos.
- **`docs/new-items-plan.md` is marked "Status: draft"**, but nearly all of it has shipped (PR #9).
