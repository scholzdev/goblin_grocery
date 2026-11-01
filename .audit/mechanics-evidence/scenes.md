# Audit: scenes (src/scenes/*, audio and input where scenes call them)

Method: code trace of ArenaScene.ts, enemies.ts, events.ts, hazards.ts, weapons.ts, gum.ts, fx.ts, phaserCtx.ts, playerOverlay.ts, audio/*, input/keyboard.ts, plus the Phaser 3.90 sources in node_modules that decide lifecycle behavior (Clock, TweenManager, Systems, SceneManager, InputPlugin). No repro test was written; constructing ArenaScene in vitest is not set up anywhere in the repo, so every "confirmed" below is a full code trace with file:line.

Counts: critical 1, high 1, medium 3, low 2.

---

## 1. Player death followed by a boss kill runs both flow.defeat and flow.victory (critical)

`src/scenes/ArenaScene.ts:1419-1431`, `:873`, `:1392-1416`, `src/scenes/enemies.ts:145-156`, `src/flow.ts:205-257`

```ts
// ArenaScene.playerDied: stops hazards, events, gum. Does NOT clear the arsenal.
this.ending = 'defeat';
...
this.time.delayedCall(1300, () => flow.defeat());

// ArenaScene.update: every frame, whatever the ending
this.arsenal.update(this.ending ? dt : dt, combat && !this.player.dead);   // shots/puddles/pots keep moving and hitting
for (const e of this.enemies) if (e.state !== 'dying') updateEnemy(this, e, combat || this.ending === 'victory' ? dt : 0, now);

// enemies.ts updateEnemy: burn and poison tick on the absolute clock, so they fire even with dt = 0
const burn = tickBurn(e.status, now);
if (burn > 0) scene.damageEnemy(e, burn, null, { isDot: true });

// killEnemy (credit = true from damageEnemy)
if (e === this.boss) this.bossDefeated();

// bossDefeated has no `if (this.ending) return` guard (miniDefeated has one at :501)
this.ending = 'victory';
...
this.time.delayedCall(2200, () => { ...; flow.victory(); });
```

Failure scenario. Boss aisle, boss at low HP and burning (or a toast/nail in flight, a fire pool or a mortar pot on the floor). The goblin dies. `damagePlayer` sets `phase = 'defeat'` and `playerDied` sets `ending = 'defeat'`, but `playerDied` never calls `arsenal.clearAll` (every other ending does), and `updateEnemy` still runs `tickBurn`/`tickPoison` on `time.now`. `damageEnemy` has no ending or phase guard. The boss dies with credit, `bossDefeated` runs unguarded, flips `ending` to `'victory'`, and 2.2 s later calls `flow.victory()`. Meanwhile `flow.defeat()` already ran at 1.3 s. `flow.victory` sets `phase = 'victory'` and calls `finish(s, true)` a second time.

Wrong outcome:
- `recordRun` runs twice (`src/state/profile.ts:119-136`): `runs` +2, one loss and one win, kills and coins added twice, `deptClears` bumped twice, `deptClears.boss` and `bestShift` credited for a lost run, `submitRun` called twice. That is persistent profile corruption, and unlocks can be granted from it.
- The defeat card is replaced by the victory card. "Keep going" (overtime) is offered, and taking it continues a run whose goblin died (`finishWave` repairs a few HP, `src/state/run.ts:395`).

The window is real: burn lasts seconds, puddles and pots last seconds, and the defeat screen usually stays up longer than 2.2 s. Nothing stops or pauses the Arena scene at run end. The only `scene.pause` is in `flow.pause` (flow.ts:271), and that refuses outside the `combat`/`checkout` phases, so the 2.2 s `delayedCall` fires. Pressing restart before the timer fires avoids it, because scene restart clears the clock.

The enabling line is `this.arsenal.update(this.ending ? dt : dt, ...)` at ArenaScene.ts:1050. Both branches are `dt`, so in-flight shots, puddles and pots keep stepping after death. If freezing them was the intent, it was lost.

Label: **confirmed** (trace through ArenaScene, enemies.ts, combat.ts `tickBurn`, projectile.ts `updateShots` (no alive-player or combat guard), flow.ts, profile.ts).

Suggested fix: guard `bossDefeated` with `if (this.ending) return;` like `miniDefeated`, and call `this.arsenal.clearAll(true)` in `playerDied`. Separately, make `flow.finish` idempotent per run, but not by checking `s.phase`. `damagePlayer` already sets `phase = 'defeat'` at death (run.ts:411), and `victory()`/`defeat()` set the phase before they call `finish`, so a phase check would bail on every run end. Guard on `flow.lastResult !== null` instead (`overtime()` nulls it, so overtime defeats still record), or use a dedicated per-run `finished` flag.

---

## 2. Pickpocket loot vanishes whenever the Pickpocket dies without kill credit (high)

`src/scenes/ArenaScene.ts:830`, `:853-854`, `:1383-1387`, `:514`, `:1411`, `src/scenes/enemies.ts:162`, `:312-316`

```ts
// killEnemy
if (!credit) return;                       // :830
...
// Pickpocket Elites cough up everything they absorbed.
for (let i = 0; i < e.loot; i++) this.dropCoin(e.x, e.y, t('coinStolen'));   // :854

// beginCheckout
alive.forEach((e, i) => this.time.delayedCall(40 * i, () => this.killEnemy(e, false))); // no kill credit
this.time.delayedCall(Math.max(1700, 40 * alive.length + 900), () => {
  this.coins.forEach((c) => { if (c.active) { ...; if (!c.bread) addCoins(store.state, 1, t('coinSwept')); } });
```

Failure scenario. An aisle reaches its clock end with a Pickpocket elite alive that has absorbed, say, 12 floor coins. `beginCheckout` kills it with `credit = false`, which returns before the loot loop, so the 12 coins are never dropped and never swept. The same happens in `miniDefeated` (:514) and `bossDefeated` (:1411). It is worse during the checkout stagger: `updateEnemy` still runs with `dt = 0`, and `affixTick` (enemies.ts:162, :313) is not gated on `dt` or on the ending. So a Pickpocket keeps vacuuming floor coins within its absorb radius until its delayed no-credit kill. Those coins would otherwise have been credited by the sweep.

handoff.md:51 specifies "lässt sie beim Tod fallen" (drops them on death), with no exception for the wave end. Floor coins are swept for the player at checkout, so coins the elite stole from the floor are the only coins a checkout destroys.

Label: **confirmed** (trace).

Suggested fix: move the loot drop above the `if (!credit) return;` line, or credit `e.loot` straight through `addCoins(..., t('coinStolen'))` on a no-credit kill. Also skip `affixTick`'s absorb while `this.ending` is set.

---

## 3. Every status timer runs on wall-clock time and keeps expiring through pause, blur and slow frames (medium)

`src/scenes/phaserCtx.ts:31`, `src/scenes/ArenaScene.ts:668`, `:1007-1009`, `src/scenes/enemies.ts:140-157`, `:308`, `node_modules/phaser/src/time/Clock.js:358-362`, `node_modules/phaser/src/core/TimeStep.js:671`

```ts
now(): number { return this.sc.time.now / 1000; }            // phaserCtx: the clock every hook and status uses
const dt = Math.min(deltaMs / 1000, 1 / 20);                 // ArenaScene.update: gameplay dt, capped
// Clock.update: this.now = time;  (time = game.loop.time, which += rawDelta every loop, paused scene or not)
```

The scene clock's `now` is `game.loop.time`. `flow.pause` (menu, loadout, window blur, `visibilitychange`) calls `game.scene.pause('Arena')`. SceneManager steps only RUNNING scenes (`SceneManager.js:566`), so `now` freezes and then jumps by the whole pause on the first resumed frame. Everything stored as an absolute `*Until` or `ctx.now()` timestamp therefore loses the paused time: marks (`markedUntil`), slow, wet, shred and weaken, `slideUntil`/`blownUntil`, the boss stagger cooldown (`staggerAt`), Tough's idle timer (`lastHitT`), Sugar Rush stacks, the liveWire, expressCheckout and slushie per-enemy ICDs, and Scoby's checks. `tickBurn`/`tickPoison` then fire every remaining tick in one frame on resume. Delayed calls (`time.delayedCall`) and `stateT`/`atkCd` use dt and freeze correctly, so the two clocks drift apart.

Failure scenarios:
- Alt-tab for 5 s with Price Check marks, frost slows or Sugar Rush stacks up. On return they are gone.
- A Tough elite that was hit 1 s before a pause starts regenerating on the first resumed frame.
- A burning group takes all its remaining burn in one frame on resume.

The same split makes the game frame-rate dependent. Below 20 fps, dt-based gameplay (movement, cooldowns, the wave clock, enemy tells) slows down while statuses keep expiring on wall time, so they buy less gameplay per second on a slow machine. The mini-boss spawn (`delayedCall`, Phaser-smoothed delta) and its enrage check (`waveTime`, capped dt) also use different clocks (ArenaScene.ts:427 vs :1031).

Label: **confirmed** for pause and blur (Phaser source plus call sites). **Plausible** for the low-fps drift (inferred from the dt cap, not measured).

Suggested fix: give the scene its own combat clock, `this.combatNow += dt` in `update` while combat runs, and return it from `PhaserCtx.now()`, `damageEnemy`'s `now` and the `now` passed to `updateEnemy`. Then pause and frame caps affect every timer the same way.

---

## 4. Burn and poison keep killing with full credit after the aisle has ended, and melon slices spawned then survive into the shop (medium)

`src/scenes/ArenaScene.ts:1040`, `:752-753`, `:864-872`, `:1383-1384`, `src/scenes/enemies.ts:145-156`

```ts
for (const e of this.enemies) if (e.state !== 'dying') updateEnemy(this, e, combat || this.ending === 'victory' ? dt : 0, now);
// updateEnemy -> tickBurn(e.status, now) -> damageEnemy -> killEnemy(e, true, hit)

if (e.affix === 'splitter' && !this.ending) { ... }   // guarded
if (e.def.id === EnemyIds.melon) { ... createEnemy(this, 'slice', ...) ... }   // not guarded
```

Failure scenario. At checkout, `beginCheckout` captures `alive` and schedules no-credit kills 40 ms apart. With 30 enemies the last one waits 1.2 s. A burning enemy whose burn tick lands first dies with credit, so `stats.kills++`, `onKill` hooks run, Punch Card progress counts, and coins drop. If it is a melon, three slices spawn. They are not in the captured `alive` list, so nobody kills them. With `dt = 0` they stay in `spawn` state, visible on the arena floor through the shop, until the next `restartArena`. After the player's death (phase `defeat`), the same credit kills keep adding `stats.kills` until `flow.defeat` computes the score at 1.3 s.

Label: **confirmed** (trace). The visibility of the slices behind the shop overlay is inferred, not seen on screen.

Suggested fix: skip `tickBurn`/`tickPoison` (or route DoT kills through `credit = false`) when `!this.combatActive()`. Add the `!this.ending` guard to the melon branch to match the Splitter branch.

---

## 5. Key and pad presses made during an ending window fire at the start of the next aisle (medium)

`src/input/keyboard.ts:14-17`, `src/ui/ui.ts:883`, `:887`, `src/scenes/ArenaScene.ts:1117-1125`, `:188`

```ts
// keyboard.ts: latched whenever phase === 'combat' && !paused
if (!e.repeat) pressed.add(a);
// consumed only in ArenaScene.updatePlayer, which runs only while `combat` (phase combat and no ending)
const key = takePressed(k) ...
```

Failure scenario. `phase` stays `'combat'` through the boss-victory sequence (2.2 s) and through the mini-boss crate pick, while `ending` is set, so `updatePlayer` never consumes presses. The player presses Q (active 1) or Space during the victory slow-mo and then chooses Keep going. The new aisle's `create` does not reset input (only scene RESUME and window blur call `resetKeyboard`), so the first combat frame of the overtime aisle fires active 1 and wastes its charge before any enemy has spawned, or dashes. The gamepad mode treats `checkout` as combat too (ui.ts:887), so a pad A or X press during the checkout sweep plausibly carries into the next aisle the same way.

Label: **confirmed** for the keyboard (trace). **Plausible** for the gamepad (`initGamepad` queueing not read in full).

Suggested fix: call `resetKeyboard()` (and clear the pad queues) in `ArenaScene.create`, or gate `initKeyboard`'s active predicate on the arena's `combatActive()` rather than on the phase alone.

---

## 6. A hazard activation is consumed by a contact the player was immune to (low)

`src/scenes/hazards.ts:133`, `:143`

```ts
if (!h.hitPlayer && inside(p.x, p.y, 10)) { h.hitPlayer = true; sc.hurtPlayer(T.playerDamage); }
```

`hurtPlayer` returns `true` even when it refused the hit (`invulnT`, `protectT` during and 0.35 s after a dash, `labGod`), and `hitPlayer` is set first. Failure scenario: dash onto a vent as it activates. The protected contact consumes the activation, and the goblin can then stand in the 0.6 s blast for free. The same happens when entering during post-hit i-frames.

Label: **confirmed** (trace). It could be an accepted design; the vent's active window (0.6 s) is close to the i-frame length.

Suggested fix: set `hitPlayer` only when the hit landed. That needs `hurtPlayer` to report it, for example by returning `false` from the immune branch at ArenaScene.ts:965.

---

## 7. A RESUME listener is added on every arena restart and never removed (low)

`src/scenes/ArenaScene.ts:188`

```ts
this.events.on(Phaser.Scenes.Events.RESUME, resetKeyboard);
```

`Systems.shutdown` (node_modules/phaser/src/scene/Systems.js:771-786) removes only the transition listeners from `scene.events`. Every `scene.restart()` (each aisle, lab tune, title) adds another copy, so after N aisles one resume calls `resetKeyboard` N times. It is harmless today because the handler is idempotent, but the listener list grows for the whole session.

Label: **confirmed** (Phaser source).

Suggested fix: use `this.events.once(SHUTDOWN, () => this.events.off(RESUME, resetKeyboard))` like the RESIZE handler at :168-169, or register it once in the constructor.

---

## Cleared hypotheses (checked, not bugs)

- A wave cannot hang on uncounted splits, summons or Pickpockets. Normal aisles end on the clock (`waveTime >= duration`, ArenaScene.ts:1035). Boss and mini aisles end on that one enemy's credited death.
- Split-of-split is impossible. Copies are created with `elite = false` (ArenaScene.ts:859), so they get no affix. `SPLITTER_EXCLUDED` (melon, slice, honey) plus `ELITE_EXCLUDED` (bosses, slice, egg, giftcard) match handoff.md:50.
- One event per aisle holds by construction. `rollEvent` returns one roll, none on boss aisles (systems/events.ts:11).
- Set-event effects revert. Every getter reads `live`, and `clearSet`/`stop` null it. Every ending calls `aisleEvent.stop()` except `bossDefeated`, which is fine because boss aisles never roll an event.
- Outage's `pointermove` listener and the lab-drag input listeners are cleared by `InputPlugin.shutdown` (`removeAllListeners`, InputPlugin.js:3134) on restart.
- `tweens.timeScale = 0.35` from `bossDefeated` cannot leak into the next run. `TweenManager.start` resets it to 1 (TweenManager.js:230).
- `stopLoops()` on pause stops only the wheel loop. Music is untouched, and `setWheel` restarts the wheel on the next moving frame.
- `killEnemy` kills the sprite's tweens (including the boss and mini drop-in tween). Shots, nearest-target lookups and telegraphs all skip `!alive`. Pushing slices or splits into `this.enemies` during a `for...of` is safe because new enemies are in `spawn` state and every damage loop skips that state.
- Regression check of the merges after handoff.md (#11 to #16), diffing `src/scenes`, `src/input` and `src/engine/actives.ts`. #13 (active slots) makes `fireActive(..., i + 1)` in `updatePlayer` and the `activeSlots(...).filter((a) => a.slot)` in `hud.tick` both read slot numbers from the same `activeSlots`, so the keys and the HUD agree. The pad got per-slot queues (X, LB, RB) with the same latching as before. #15 (lab bench) restarts the arena through `labTune` → `labKeepDummies` → `restartArena`. Its listeners are cleaned on shutdown, apart from the RESUME leak in finding 7. No regression found.
- Coin magnet and pickup. Overshoot at capped dt is caught the next frame (`d < 26` with `pull`). When the coin pool is exhausted, the coin is credited directly.

## Out of scope leads

- `docs/buildlab.md:194` says the buildlab's Tough regen is "HP delta based". The game resets Tough's idle timer only on non-DoT hits (enemies.ts:308, ArenaScene.ts:715), so a burning Tough elite regenerates in game but not in the buildlab model. The balance numbers may be off for DoT builds.
- `src/flow.ts:205` and `:222` (`victory`/`defeat`) have no once-per-run guard. Any second caller double-records the run (see finding 1).
- `src/state/run.ts:408-412`: `damagePlayer` sets `phase = 'defeat'` immediately, 1.3 s before `flow.defeat`. That is why `flow.pause` refuses after death and why `combatActive()` is already false while shots keep flying.
