# Bugs found in the October 2026 audit

Status: draft, 2026-10-20. Severities are after verification. See [README.md](README.md) for the method and the labels.

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 2 |
| Medium | 10 |
| Low | 37 |

Critical means a crash, a softlock, save corruption, or a lost run. High means a wrong rule that a player will hit. Medium means an edge case or a visible glitch. Low means polish, text, dev-only tooling, or dead code. Severity also weighs how likely a player is to hit the bug. Bug 2 writes a false win into the profile, but its trigger window is narrow, so it is high and not critical.

## Critical

### 1. A controller-only player cannot pick from the stockroom or the mini-boss crates

Confirmed by trace and by a refuter's repro.

`src/input/gamepad.ts:125-128` handles only shove while the mode is `'combat'`, then returns. `src/ui/ui.ts:887` reports `'combat'` for both the `combat` and `checkout` phases. The stockroom overlay (`src/ui/stockroom.ts:20-57`, opened from `src/scenes/ArenaScene.ts:1359`) opens while the phase is still `combat`. It accepts only a click, Enter on a focused card, or the keys 1 to 3. The pad never moves focus to a card and never confirms one. Those aisles have no timer, so the run cannot continue.

The README advertises full gamepad support, and the mini-boss crate pick comes up in most runs. A player with only a controller loses every run that reaches it. Any keyboard, mouse or touch input frees the run, which is why one refuter rated it high.

Fix: give the overlay a pad context while it is open. Either add a menu mode scoped to `.stockroom`, or route the d-pad and A in `frame()` to the cards. The cards already have `tabindex="0"` and an Enter handler.

## High

### 2. A boss killed after the goblin dies records the run as both a loss and a win

Confirmed by trace and by a refuter's repro of the profile half.

`playerDied` (`src/scenes/ArenaScene.ts:1419`) sets `ending = 'defeat'` and calls `flow.defeat()` after 1.3 s. It never calls `arsenal.clearAll`. `update` keeps calling `updateEnemy` with `dt = 0` (`:1040`), but burn and poison tick on the absolute clock (`src/systems/combat.ts:27-33`). A burn tick can therefore still kill the boss. `bossDefeated` (`:1392`) has no `if (this.ending) return` guard, unlike `miniDefeated` (`:501`). It calls `flow.victory()` 2.2 s later. Neither `flow.victory` nor `flow.defeat` (`src/flow.ts:205-226`) guards against a second call, so `finish` runs twice.

The profile then records two runs, one loss and one win. Kills and coins count twice. The phantom win credits `deptClears.boss` and `bestShift`, which can unlock the next shift. The window is narrow. The boss must die from a damage-over-time tick or a shot already in flight, and the player must not leave the end card within 2.2 s.

Fix: add `if (this.ending) return` to `bossDefeated`, and call `this.arsenal.clearAll(true)` in `playerDied`. Also make `flow.finish` run once per run. Do not guard on `s.phase`, because `damagePlayer` already sets `phase = 'defeat'` at death (`src/state/run.ts:411`), so a phase check would block every run end. Guard on `flow.lastResult` or a per-run flag.

### 3. Restart from the pause menu turns a daily run into a normal run

Confirmed by trace and by a refuter's repro.

`src/ui/ui.ts:594` handles `restart` with `flow.startRun()` and no `{ daily }` option. The new run copies the daily loadout, so it looks like the daily. It gets a random seed and no daily flag. The retry is lost from daily tracking and the history badge. If the player holds a coupon, the restart also spends it.

Fix: mirror the `again` branch and pass `{ daily: !!store.state.daily }`.

## Medium

### 4. Status timers keep running while the game is paused

Confirmed by trace.

Every status and hook timer reads the scene clock's `time.now` (`src/scenes/phaserCtx.ts:31`). That clock jumps forward by the whole pause on resume. Marks, slow, weaken, shred, wet, Sugar Rush, per-enemy cooldowns, the idle timer for Tough regen, and the boss stagger cooldown all expire during a pause menu or an alt-tab. Burn and poison deal all their remaining ticks in one frame on resume. The total damage stays the same, but it lands as a spike.

Fix: give the scene a combat clock (`this.combatNow += dt` in `update` while combat runs). Return it from `PhaserCtx.now()`, from `damageEnemy`, and from the `now` passed to `updateEnemy`.

### 5. The stockroom overlay draws above the pause menu and still takes picks

Confirmed by trace.

The stockroom has `z-index: 40` (`src/ui/style.css:912`), and the pause overlay has none. The 1 to 3 key handler (`src/ui/stockroom.ts:51-55`) does not check `flow.paused`, so a pick goes through while the game is paused. The pause buttons are still reachable below the overlay.

Fix: hide the overlay while `flow.paused`, and return early from `onKey` when paused.

### 6. The set badge on a double pack predicts the wrong set level

Confirmed by test. Two auditors found it on their own.

`setGains` (`src/data/sets.ts:44-48`) uses the weight of the first copy of a type, and it never checks whether a placed copy is already a double. `setCount` takes the largest weight per type. With `[bell (double), pricegun]`, a double Bell offer previews a level-up to L3, but the count stays at 3 after the purchase. The badge can sell a pack at 1.5x the price on a level-up that never happens. The engine counts sets correctly. Only the preview is wrong.

Fix: return `setCount(placed + the offered instance) - setCount(placed)`.

### 7. Merging drops the consumed copy's counters

Confirmed by test.

`src/state/run.ts:211-214` carries only `tier` and `double` into the merge target. Dragging a cart Basil with 200 kills onto a shelf Basil gives a ★2 Basil with 0 kills. Dragging a stinking Fresh Fish onto a fresh one resets the rot, so the crit bonus returns and the price markup goes away. Scoby age and Binder sales are lost the same way. Dragging the shelf copy onto the cart copy keeps the counters.

Fix: carry the counters into the target. Sum or max `kills`, take the max `age`, and sum `binderSold` only when both Binders share `binderFamily`.

### 8. The inspector's Combine button on a shelf item consumes the cart copy

Confirmed by trace.

`mergePartner` (`src/ui/shop.ts:344-346` and `:597-600`) prefers a shelf partner and otherwise takes the cart copy as the one to consume. The ★2 result lands on the shelf, which does not fight, and leaves a hole in the cart. Together with bug 7, the cart copy's counters are lost as well.

Fix: when the inspected item is on the shelf and the partner is in the cart, call `mergeItems(s, uid, partner)` so the cart copy is always the target.

### 9. Adjacency hooks use the tier of the best copy anywhere in the cart

Confirmed by test for Decaf and the Scoby. The auditor reports that Can Opener, Sparklers and Moldy Bread take the same path. The refuter did not check those three.

`HookCtx.touching` (`src/engine/hooks.ts:314` and `:323`) returns the item type, and hooks then read the highest tier of that type in the whole cart. A Toaster touching a ★1 Decaf, with a ★3 Decaf elsewhere, weakens by 25% instead of 15%. The Kombucha Scoby reads the raw tier (`src/content/items/scoby.ts:21`), so Gold Star does nothing for it. It poisons for 2 dps instead of 3.

Fix: return `{ instance, tier }` with the effective tier from `HookCtx.touching`, as `BuildCtx` already does.

### 10. The Pickpocket's stolen coins vanish when it dies without kill credit

Confirmed by trace and by a refuter's repro.

`killEnemy` returns at `if (!credit) return;` (`src/scenes/ArenaScene.ts:830`) before the loot drop at `:854`. Checkout (`:1384`), mini-boss death (`:514`) and boss death (`:1411`) all kill the remaining enemies without credit. A Pickpocket elite alive at the end of an aisle therefore loses every coin it took. The coins are already off the floor, so the checkout sweep misses them too. This contradicts `handoff.md`, which says the Pickpocket drops its coins on death.

Fix: move the loot drop above the credit check.

### 11. The double-pack chip in the item inspector is cut off

Confirmed by screenshot (`shop-hover-offer.png`).

`.inspector .chip` has `white-space: nowrap` and `flex: 1` (`src/ui/style.css:781`). The chip text is long (`src/ui/shop.ts:383`, `src/i18n/ui.ts:465`), so the English line stops at "(cost". The hidden part, "costs 1.5×", is the reason the offer is more expensive. The German text loses more. The offer card still shows the price and the 2-PACK sticker.

Fix: let `.chip.dbl` wrap (`white-space: normal; flex-basis: 100%`).

### 12. German item names overflow their cart cell

Confirmed by screenshot (`shop-de.png`).

`.item .tag` (`src/ui/style.css:329`) expects names to wrap, but a German compound such as "Einkaufsklingel" has no break point. It runs past the cart frame. "Tischventilator" is cut to "TISCHVEN" and "Rennstiefel" to "RENNSTIE". `ui.ts` already sets `<html lang>` from the locale.

Fix: add `overflow-wrap: anywhere; hyphens: auto;` to `.item .tag`. [visual.md](visual.md) proposes a larger fix, which shows names on 1x1 items only on hover.

### 13. The build lab drops every shot, fire pool and beam that a hook spawns

Confirmed by trace. Found by the coverage pass.

In the game, `src/scenes/phaserCtx.ts:100-105` sends `ctx.spawnShot`, `ctx.spawnPool` and `ctx.beam` to the arsenal. In the build lab, `FakeCtx.spawnShot` pushes to `fake.playerShots`, which nothing moves or collides (`src/engine/fakeCtx.ts:319-327`). `spawnPool`, `beam`, `sweep` and `explode` only log (`:337`). The step loop reads only `dropCoin` calls and then clears the log (`src/buildlab/combat.ts:454-455`). `UNMODELLED_COMBOS` (`src/buildlab/balance.ts:35-37`) does not list the combos affected, so the balance report treats them as modelled. With Ray Gun, the Nail Gun deals 0 damage in the lab.

This is not a player-facing bug. The affected combos are Ray Gun, Shrapnel, Kettle Corn, Reheat, Pressure Point, Sizzling Skillet and the Power Surge echo. In 600 greedy runs on the full pool (seed 1), 11.0% ended with one of them active (Sizzling Skillet 43 runs, Kettle Corn 12, Reheat 8, Shrapnel 4, Ray Gun 0). The October balance hillclimb tuned the wave curve on this proxy. How much the gap moved its win rates is unmeasured. See [mechanics.md](mechanics.md).

Fix: connect the `FakeCtx` effect stubs to the `FakeArsenal` that `playAisle` builds. `FakeArsenal` already implements `PatternHost`.

## Low

Every low bug below is confirmed by trace unless the row says otherwise.

| # | Bug | Where | Fix |
|---|---|---|---|
| 14 | Burn and poison keep killing with full credit after the aisle ends. Melon slices spawned then survive into the shop. | `src/scenes/ArenaScene.ts:1040`, `:864` | Skip DoT ticks, or kill without credit, when combat is not active. Add the `!this.ending` guard to the melon branch. |
| 15 | Keys pressed during an ending (checkout sweep, victory, crate pick) fire on the first frame of the next aisle. One dash is spent. | `src/input/keyboard.ts:17`, `src/scenes/ArenaScene.ts:1117` | Call `resetKeyboard()` and clear the pad queues in `ArenaScene.create`. |
| 16 | A hazard activation is spent on a contact the player was immune to. | `src/scenes/hazards.ts:133`, `:143` | Set `hitPlayer` only when `hurtPlayer` reports a hit. |
| 17 | A `RESUME` listener is added on every arena restart and never removed. | `src/scenes/ArenaScene.ts:188` | Remove it on `SHUTDOWN`, as the `RESIZE` handler at `:168` does. |
| 18 | Tab, the default cart-view key, has its default action blocked on every screen. Keyboard-only players cannot move focus in menus. | `src/ui/ui.ts:846-848` | Intercept the loadout key only in combat or while the loadout view is open. |
| 19 | The fourth door shows the key "4", but the handler accepts only 1 to 3. The door appears only when the player holds a Shortcut Key. | `src/ui/ui.ts:826` | Accept digits up to `doors.length`. |
| 20 | Starting a mouse drag while the pad holds an item leaves the first drag image on screen. | `src/ui/shop.ts:661-683` | Call `cancelDrag()` at the start of `beginDrag`. |
| 21 | A key swap can move Escape onto cart view or rotate, which then cannot fire from the keyboard. Partly confirmed. The report's repro used the wrong slot, and the action can be rebound. | `src/state/keymap.ts:85-94` | Never swap Escape onto an action other than `pause`. Clear the slot instead. |
| 22 | Pressing Start on the pad while a rebind is waiting binds the next combat key. | `src/ui/ui.ts:854-857` | Call `stopListening()` in `togglePause`. |
| 23 | The Punch Card text does not update after a language change. (The active-slot key labels went away with the active system.) | `punchcard.ts:28-30` | Add the language to the cache key. |
| 24 | The desktop fullscreen setting drifts from the real window state. | `electron/main.cjs:36-37`, `src/ui/ui.ts:820-823` | Send fullscreen change events to the page, or read `isFullscreen()` before F11 toggles. |
| 25 | A daily run that crosses midnight is booked on the new day's board. | `src/state/profile.ts:213-225` | Store the daily key on the run at start and compare it at finish. |
| 26 | Test Lab only. The lab modal stays inside the hidden title screen and swallows the first Escape. | `src/ui/ui.ts:617-623`, `:831` | Call `closeTitleSettings()` before starting the lab or a sim. |
| 27 | Saved language and profile ids are not validated at load. Latent crash on corrupted or renamed data. Partly confirmed. | `src/state/settings.ts:45-47`, `src/state/profile.ts:53-63` | Check `language` against `LANGS` and filter stored ids against the current tables. |
| 28 | The tutorial bubble draws above the pause menu. Partly confirmed, the stacking was not checked on screen. | `src/ui/style.css:697`, `tutorial.ts:91-104` | Hide `#tutorial` while paused. |
| 29 | Kills and coins from overtime aisles never reach lifetime stats, so unlocks that count them ignore overtime. | `src/flow.ts:238-247` | Add the overtime delta to lifetime stats and evaluate unlocks in the overtime branch. |
| 30 | The Kitchen set L3 heal floater shows +3 while it heals 4. | `src/scenes/ArenaScene.ts:766` | Pass the healed amount to `healFx`. |
| 31 | Fire pools from Microwave, Pressure Cooker and Frying Pan re-apply burn every frame, because those weapons have `tick: 0`. Damage is unchanged, but reactions fire every frame. | `src/engine/patterns/puddle.ts:18`, `:48` | Advance burn-only pools by `pd.burn.tick`. |
| 32 | The Kitchen set comment says popper kills count toward the heal. Popper blasts pass `stats: null`, so they never count. | `src/content/sets/kitchen.ts:32` | Decide the rule, then fix the comment or the code. |
| 33 | Tests only. `FakeCtx` checks `armored` against the damage from before affinity and mark. | `src/engine/fakeCtx.ts:391` | Compare against the final pre-armor damage, as the scene does. |
| 34 | The shop offers legendaries the player already owns. A second Expired Coupon or Snack Bag does nothing. | `src/systems/shop.ts:65` | Filter owned legendaries, as `rollMiniCrates` does at `:108`. |
| 35 | A second Shortcut Key gives a second skip. The item text says "once per run". | `src/systems/shortcut.ts:11-21` | Check `skippedAisles` in `canShortcut`, or reword the text. |
| 36 | Test Lab only. Every trip to the editor ages perishables and Sourdough. | `src/flow.ts:155-171`, `src/state/run.ts:330-337` | Skip `ageItems` in the lab sandbox. |
| 37 | Sims only. Buying a bigger cart shrinks a cart that is not on the size ladder. Partly confirmed, no shipped sim triggers it. | `src/state/run.ts:463`, `:484` | Take the max per dimension. |
| 38 | Victory credits an aisle skipped with the Shortcut Key as cleared, worth 250 score. | `src/flow.ts:209` | Subtract `skippedAisles.length`. |
| 39 | Obsolete: the active system was removed, the four items trigger automatically. (Was: active-item tooltips say "E" in English and German.) Since PR #13 the slots are Q, E and F in cart order. | `src/content/items/airhorn.ts:8`, `bubblewrap.ts:8`, `vacuum.ts:15`, `fireextinguisher.ts:9`, `src/engine/define.ts:241` | Drop the key from the text and let the slot chips show it. |
| 40 | Binder and Shortcut Key are offered at ★2 and ★3 for 2x and 4x the price with the same effect. Partly confirmed. The report's claim that players can pay coins to upgrade is wrong, because `upgradeItem` has no UI caller. | `src/systems/shop.ts:72` | Add a `tierless` flag and honor it in `rollOffers` and the merge rules. |
| 41 | Pressure Washer sets the spray cone to 25° and cancels Mist Machine's 120°. A test pins it as intended, but neither combo text says so. | `src/content/combos/pressureWasher.ts:25` | Add `replaces: [Combo.mistMachine]`, or say it in both texts. |
| 42 | Sparklers uses the Blast set's L1 radius at L2 and L3. Confirmed by test. | `src/content/items/sparklers.ts:24` | Pass the current set level to `tuneOf`. |
| 43 | Ray Gun's tooltip says +20% splash. The red bolt deals 120% splash, against 60% normally. | `src/content/combos/rayGun.ts:16`, `:31` | Fix the text. |
| 44 | Sparklers ★3 reads "Every 3th direct hit" in English. | `src/content/items/sparklers.ts:10` | Drop the ordinal. |
| 45 | The Electric set text says "Electric hits", but the bonus follows the `electrical` flag and skips auras. | `src/content/sets/electric.ts:14-16` | Reword to "Electrical weapons" and mention auras. |
| 46 | German enemy hints for Honey and Egg say "platzieren" (place) where "pop it first" is meant. | `src/content/enemies/honey.ts:16`, `egg.ts:15` | Fix the German text. |
| 47 | An enemy and an item are both called "Expired Milk". | `src/content/enemies/expired.ts:15`, `src/content/items/expiredmilk.ts:10` | Rename the enemy. |
| 48 | The victory receipt always says the Store Manager was beaten. Four of five bosses are themed. Confirmed by screenshot. | `src/ui/ui.ts:551` | Add a `bossReturned` string with the boss name. |
| 49 | The HUD subtitle reads "MANAGER" in every boss fight. | `src/state/run.ts:436`, `src/ui/hud.ts:86` | Print the boss's short name on the boss aisle. |
| 50 | Dev only. The sim note draws under the 2-PACK sticker. | `src/ui/style.css:967` | Raise `#simnote` above the shop. |

## Unverified leads

Nobody traced these end to end. Each needs one look before it becomes a ticket.

- The Punch Card never rolls in the build lab, so the balance report counts it as modelled while its effect there is 0 (`src/buildlab/combat.ts`, `src/buildlab/balance.ts:29-34`).
- Restarting or quitting a run never records it as a loss.
- Electron has no single-instance lock, so two open windows overwrite each other's profile.
- The build lab resets Tough regen on any HP change. The game resets it only on hits that are not damage over time, so a burning Tough elite regenerates in the game but not in the lab (`docs/buildlab.md:194`).
- A won run that used the Staff Only skip bumps `deptClears.boss` twice. The skip pushes a placeholder into `route` (`src/state/run.ts:430-438`), so the boss entry falls inside `slice(0, wavesCleared)` in `recordRun` (`src/state/profile.ts:128`), and `:131` bumps it again.
- `ArenaScene.stunEnemy` (`:571`) stuns a non-boss enemy in any state and keeps the longer of the stun and the time left in that state.

## Design question, not a bug

Daily runs do not give every player the same shops. Credited kills draw from `flow.rng`, the stream the shop rolls from, so offers depend on how many enemies a player killed. `docs/item-hooks-refactor.md:611` says this is deliberate for now.

## Stale docs

- `handoff.md` describes `SET_L3` and `setCfg`. Both are gone since commit `701cf6a` moved sets to `src/content/sets`.
- The README says 31 items and 10 combos. The game has 64 shop items and 38 combos.
- `docs/new-items-plan.md` says "Status: draft", but almost all of it shipped in PR #9.
