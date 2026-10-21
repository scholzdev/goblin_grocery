# About the game's mechanics, October 2026

Status: draft, 2026-10-20. This is a design review. It explains where the decisions in a run go dead and ranks proposals to fix that. See [README.md](README.md) for how the audit ran.

## How to read the numbers

Every number carries one of three labels.

- **Structural.** It follows from the rules and the shop rolls alone, so it holds however the bot fights. Offer odds, merge counts and combo-part availability are structural.
- **Proxy.** It comes from the build lab's combat model. Compare proxy numbers with each other, never with human win rates.
- **Judgment.** A design opinion, with its reasoning.

The evidence comes from fresh build lab runs. These were 600 greedy runs on the full item pool, the same 600 seeds on the 18 starter items, six policy variants on one shared seed (300 runs each), and two `buildlab evolve` runs. At 300 runs the standard error of a win rate is about 2.7 points.

## The proxy has three blind spots

Treat every proxy number in this doc, and in the October hillclimb, with these limits in mind.

1. The cart stands still, and a fixed hit chance stands in for dodging. `docs/buildlab.md` says the exposure constants are not calibrated against human play.
2. Greedy placement scores only combos and module buffs, one item at a time. A passive combo part scores nothing until the last part lands, so it goes in the first free cell. Nailstorm formed in 0 of 201 runs that owned all three parts. The Nail Gun's low win rate (15.5%, against 38% for the Pan) is at least partly this artifact.
3. The proxy drops every shot, fire pool and beam that a hook spawns ([bugs.md](bugs.md), bug 13). With Ray Gun, the Nail Gun deals 0 damage in the lab, and the balance report does not list the combos affected. The gap touches a minority of runs. 11.0% of 600 greedy runs ended with an affected combo active, mostly Sizzling Skillet.

The hillclimb raised the Day win rate from 1.8% to 26% on this proxy. Nobody has measured how much blind spots 2 and 3 moved those numbers. My read is that the relative changes are probably right and the absolute targets mean little. Before the next round of tuning, fix blind spots 2 and 3, then calibrate the exposure constants against one recorded human run.

## Unlocks make each run less coherent

This is the main finding. It is structural.

The shop shows 4 offers per shop, about 28 per run, drawn from 64 items. `weight()` (`src/systems/shop.ts:35-39`) favors combo partners of owned items (2.2), enhancers (1.8) and owned weapon types (1.6). Owned non-weapons get no duplicate weight, and one shop never offers the same type twice.

| Measure | Full pool (64) | Starter pool (18) |
|---|---|---|
| Merges per run | 0.95 | 3.48 |
| ★3 items at run end | 10 of 5,581 | 188 of 5,665 |
| Combos active at run end | 1.25 | 2.00 |

In runs that reached shop 7 on the full pool, all parts of a 2-part combo showed up in 14% to 57% of runs. All parts of a 3- or 4-part combo showed up in 4% to 11%. On the starter pool, the 10 reachable combos show up in 60% to 87% of runs.

Every unlock therefore makes any given build rarer. The game rewards progress with a less coherent run. The merge rule (★1 + ★1 makes ★2) was a pillar of the original brief, and at 64 items it almost never happens.

## Shop 1 decides the build before the player looks

`STARTER_WEAPONS.guarantee` (`src/data/items.ts:78-82`) puts the starting weapon's two combo parts into shop 1. The player arrives with about 26 coins, and the two parts cost about 20. Toast Mode formed in 180 of 180 runs that owned its parts. Express Checkout formed in 205 of 209. These two are the most common combos in the game, at 34% and 30% of runs, against 8% at most for any other. The weapon pick on the title screen sets the run's identity, not a shop decision.

## Tiers barely pay off

A ★2 weapon costs 2 copies and gives about 1.67x the DPS. A ★3 costs 4 copies for about 2.5x (`src/engine/define.ts:80-81`). Four separate ★1 copies give 4x, if the cart has room. In the paired proxy test, a policy that built 497 ★3 items won 34.3%, against 33.7% for greedy. The hillclimb tried a larger tier multiplier twice, and both times the win rate moved by less than 1 point.

`upgradeItem` (`src/state/run.ts:241`) has no UI caller. `src/ui/shop.ts:445` says combining is the only way to level up. The browser bot calls `upgradeItem` anyway (`src/bot/bot.ts:389`), so botrun numbers assume a tiering path that players do not have.

## Placement matters less than the design intends

The cart starts at 4x4 (`src/state/run.ts:57`). Its center cells touch almost everything, so "weapon in the middle, everything else around it" is close to optimal every time. A policy that ignores combos and buffs when it places items wins 25.7%, against 33.7% for greedy (proxy). That gap is real, but small. The Bundle Deal (+6% per distinct neighbor type) rewards the same answer. Placement starts to matter only after cart upgrades, and 83% of greedy runs end at 4x4.

## Difficulty is flat, then a cliff, then a coin flip

Death rate among runs that reached each aisle, from 600 greedy runs (proxy):

| Aisle | 1 | 2 | 3 | 4 | 5 | 6 | 7 | Boss |
|---|---|---|---|---|---|---|---|---|
| Deaths | 0% | 0% | 2% | 28% | 20% | 23% | 23% | 23% |
| HP lost | 2.2 | 0.7 | 9.0 | 18.1 | 18.2 | 24.1 | 27.9 | 26.5 |

Aisles 1 and 2 are two minutes in which nothing can go wrong. Aisle 4 holds 37% of all deaths. The mini-boss arrives at 8 s, and spitters, turkeys, cereal and expired milk all join the roster at once (`src/data/waves.ts:10`). From aisle 5 on, each aisle is about as likely to end the run as the last.

Runs die from near-full HP inside one aisle. 323 of 444 deaths started that aisle at 30 HP or more. HP is not a resource managed across the run, so the door choice (Rush, Quiet, Event) is mostly a coin choice made blind.

The shift ladder is steep at the first step. Day sits at 26%, Evening at 8.5% and Late at 2.1% (proxy).

## Saving, rerolling and selling are never worth it

Inflation costs 10% per shop. Interest exists only at Checkout set level 2 or higher, +1 per 10 coins held, capped at 5 (`src/state/run.ts:392`). Holding 50 coins for one shop is break-even at best, and only with that set. Both evolve runs settled on keeping no coin reserve, never rerolling, and never selling. The shop lock is the one real saving decision, and it saves an offer, not coins. Keep it.

## The player cannot tell what killed them

`hurtPlayer(dmg)` (`src/scenes/ArenaScene.ts:962`) takes no source. The end receipt has a detailed breakdown of damage dealt and nothing about damage taken. Runs die from full HP in a single aisle, so "what hit me" is the lesson a player most needs, and the game does not give it.

## Too many systems are visible at once

A single shop card can involve module adjacency, the Bundle Deal, 38 combos, 9 sets at 3 levels each, double packs, 6 element reactions, tiers, perishables, Jelly Bean flavors and Q, E and F actives. The fight adds 5 elite affixes, 5 hazards, door modifiers, special rooms, set events, zones and Punch Card goals. Each layer is reasonable alone. No layer is introduced alone. Sets count anywhere in the cart and adjacency counts neighbors, so the two pull placement in different directions, and the player cannot easily tell which one moved a number.

## Ranked proposals

Cost is S for under a day, M for a few days, and L for a week or more. None of these repeat `docs/new-items-plan.md`, which has almost entirely shipped.

| # | Problem | Change | Cost | Files |
|---|---|---|---|---|
| 1 | Unlocks dilute every run. | Draw a per-run stock of 22 to 26 items at run start: the theme's bias items, 2 or 3 featured families, the starting weapon's combo partners, and one legendary. Show the featured families on the start screen. Unlocks then add variety between runs instead of inside one. | M | `src/state/run.ts`, `src/systems/shop.ts:63-65`, `src/types.ts`, a start screen line |
| 2 | Duplicates are rare, so merging is starved. | Owned types below ★3 get weight 2.5. From shop 3, one slot is a "Restock" copy of an owned item. | S | `src/systems/shop.ts`, `src/ui/shop.ts` |
| 3 | Shop 1 decides the build. | Offer one part each of 2 or 3 different combos for the starting weapon, plus one random item. | S | `src/data/items.ts:78-82`, `src/systems/shop.ts:61` |
| 4 | The player cannot see what killed them. | Pass a source to `hurtPlayer`. Show "Wiped out by" and the top 3 damage-taken sources on the receipt. | S to M | `src/scenes/ArenaScene.ts:962` and about 10 callers, `src/systems/damageStats.ts`, `src/ui/ui.ts:546` |
| 5 | Aisles 1 and 2 are empty, and aisle 4 is a cliff. | Make aisles 1 and 2 35 to 40 s long with denser spawns. Spread aisle 4's new enemy types over aisles 3 to 5. Retune the shifts so Evening sits nearer 15%. Calibrate the proxy first. | S to M | `src/data/waves.ts:7-14` |
| 6 | Linear tier stats don't change outcomes. | Give each weapon one new behavior at ★3, such as an extra toast for the Toaster, a full 360° sweep for the Pan, or one more pierce for the Nail Gun. | M | `src/content/items/<weapon>.ts`, `src/engine/define.ts` |
| 7 | Cleaning and Frost level 2 and 3 are near unreachable. | Count a set by the sum of tiers, so a ★2 counts 2, as the double pack already does. Or give small sets lower thresholds. | S | `src/data/sets.ts:23-50`, `src/engine/define.ts:84` |
| 8 | Holding coins is never right. | Base interest for everyone, +1 per 10 held, capped at 3. The Checkout set raises the cap to 6, then 10. Show the next interest in the shop footer. | S | `src/state/run.ts:392`, `src/content/sets/checkout.ts:8`, `src/data/waves.ts:70` |
| 9 | Doors are picked blind. | List the aisle's 2 or 3 most common enemy types, any forced elite affix, and the hazard level on each door card. `waveSpawnPlan` already computes them. | S to M | `src/systems/shop.ts:81-125`, route UI |
| 10 | Adjacency is nearly free in a 4x4 cart. | Make 3 or 4 modules directional, so R-rotate matters. Do it only together with proposal 11. | M | `src/systems/synergies.ts`, those modules, `src/ui/shop.ts` |
| 11 | About 10 build layers are visible from shop 1. | Hide set chips until 2 items of one set are owned. Introduce reactions on the first one that fires. Hide the Q, E and F slots until an active is owned. | M | `src/ui/shop.ts`, `src/ui/hud.ts`, profile flags |
| 12 | Unlocks are passive milestones. | Replace a third of them with build goals, such as "win with Frost level 2". Feature a fresh unlock in the next run's stock. | S | `src/data/unlocks.ts`, `src/state/profile.ts` |

My order is 1, 2 and 3 first, because together they fix the structural problem that the game gets less coherent as it grows. Proposal 4 is the cheapest win for player understanding. Proposal 5 should wait until the proxy is calibrated, or it will tune against the same blind spots as the last round.
