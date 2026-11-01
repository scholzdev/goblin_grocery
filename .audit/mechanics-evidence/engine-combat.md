# Audit: engine-combat

Scope: `src/engine/*`, `src/engine/patterns/*`, `src/systems/*` (not shop.ts), `src/data/*` tables, plus the set content files (`src/content/sets/*`) and the damage pipeline in `ArenaScene.damageEnemy`, because the set-L3 and pipeline hunt leads there.

Method: read the set, hook, build, status, reaction, affinity and pattern modules, and traced the damage pipeline. Then ran one throwaway probe (`tests/_audit/engine-combat-probe.test.ts`, deleted afterwards). It covered `setGains` against `setLevels`/`setCount` and evaluated every array tune of every non-weapon, non-legendary item at Gold Star's effective ★4.

Counts: critical 0, high 0, medium 1, low 4.

## Bugs

### 1. `setGains` preview disagrees with the real set count when a cart holds two copies of a type (double packs). Severity medium.

`src/data/sets.ts:44-48`
```ts
for (const p of placed) if (setsOf(p.type, flavorOf(p)).includes(id) && !seen.has(p.type)) { seen.add(p.type); have += weightIn(p, id); }
const add = double && ITEMS[type].family === id ? 2 : 1;
if (seen.has(type) && !(double && add === 2)) continue;
...
const to = have + (seen.has(type) ? 1 : add);
```
`setCount` and `setLevels` take the largest weight per type (`Math.max`). `setGains` takes the weight of the first copy it meets, and it never checks whether the owned copy is already a double pack. Unmerged duplicates are normal: merging is a manual drag (`state/run.ts:203-216`), and two ★3 copies cannot merge at all.

The probe confirmed both failure scenarios.
- Cart `[bell, bell(double)]`. `setCount(checkout)` is 2, at level 1. `setGains(placed, 'pricegun')` reports `from: 1, to: 2`, but the true change is 2 to 3. The pip row and the from/to shown on the card are off by one.
- Cart `[bell(double), pricegun]`. `setCount` is 3, at level 2. A double-pack Bell offer previews `{from: 3, to: 4, levelUp: true}`, a promised jump to set level 3. After buying it, `setCount` is still 3. The shop advertises a level-up that never happens, on an offer priced ×1.5 (`ECONOMY.doublePackPriceMult`).

Label: **confirmed** by the probe test.

Fix: per type, compute the same `max(weightIn)` that `setCount` uses. Then set `to = have - ownWeight + max(ownWeight, add)` and skip when `to === have`. Simpler still, return `setCount(placed + hypothetical instance) - setCount(placed)`.

### 2. Kitchen set L3 heal shows "+3" while it heals 4. Severity low.

`src/scenes/ArenaScene.ts:766`
```ts
onComplete: () => { h.destroy(); this.fx.number(this.player.x, this.player.y - 90, contentSetTune('kitchen', 1).heal, '#8FCB57', 20); ... },
```
The Kitchen tune is `heal: [3, 3, 4]` (`src/content/sets/kitchen.ts`). The afterKill hook heals `c.tune().heal`, which is 4 at L3. It then calls `ctx.healFx(x, y)`, which carries no amount (`src/engine/ctx.ts:191`, `src/scenes/phaserCtx.ts:98`), so the floater always reads the level-1 value. This is the only level-sensitive `contentSetTune(..., 1)` left. The other callers read flat scalars: `reactions.ts:188` electric `range`, and the checkout interest that passes the real level.

Label: **confirmed** by trace.

Fix: pass the healed amount through `healFx(x, y, hp)`, as `ctx.heal(t.heal)` already has it, and print that.

### 3. Fire pools (Reheat, Pressure Point, Sizzling Skillet) re-apply their burn every frame. Severity low.

`src/engine/patterns/puddle.ts:18` and `:48`
```ts
h.puddles.push({ ..., nextTick: h.time, stats: st, burnOnly: true, burn: { ..., tick: tune.tick } });
...
pd.nextTick += pd.stats.tick; // fixed tick: each enemy inside is hit once per tick
```
The pool's cadence reads the *weapon's* `tick`. The three pool combos sit on the Microwave, Pressure Cooker and Frying Pan, and all three keep the `weaponBase` default `tick: 0` (`src/engine/define.ts:128`). So `nextTick` never advances, and every frame every enemy in the pool gets `applyBurn` plus `sc.reactionApplied(e, 'burn')`. The burn numbers come out the same, because `applyBurn` refreshes without stacking. But the comment's "once per tick" contract is broken. The reactor runs about 60 times a second per enemy in the pool, so Shatter and Fumes fire the moment their cooldown ends instead of on a 0.5 s cadence.

Label: **confirmed** by trace (weapon bases in `src/content/items/{microwave,cooker,pan}.ts`, combo requirements in `src/content/combos/{reheat,pressurePoint,sizzlingSkillet}.ts`).

Fix: advance burn-only pools by `pd.burn.tick` (the combo's 0.5) instead of `pd.stats.tick`.

### 4. Kitchen comment says popper kills count, but popper blasts carry no stats. Severity low.

`src/content/sets/kitchen.ts:32`
```ts
// Kills by a kitchen weapon (popper blasts included: they carry the weapon's stats).
```
Both `ArenaScene.popperBlast` (`src/scenes/ArenaScene.ts:792`) and `FakeCtx.popperBlast` (`src/engine/fakeCtx.ts:333`) damage with `stats: null`. So `ev.hit?.stats` is null on a popper kill, and the Kitchen L2/L3 heal never rolls for it. Either the comment is stale or the intended rule was lost in the content-file move. The Blast set's afterKill comment ("not popper blasts") matches the code.

Label: **confirmed** by trace that the code ignores popper kills. Which behavior was intended is unknown.

Fix: decide the rule. Either delete the parenthetical, or pass the weapon stats into `popperBlast` from `applyKillEffects`. The second option also changes crit, statuses and set bonuses on popper hits, so it is a balance change.

### 5. FakeCtx computes `armored` against a stale damage value. Severity low (tests only).

`src/engine/fakeCtx.ts:391`
```ts
hit.armored = dmg < hit.dmg * 0.5; hit.dmg = dmg;
```
On a non-crit hit, `hit.dmg` here still holds the post-`modifyDamage` value, before affinity, wet and mark. The scene compares against the current `dmg` (`ArenaScene.ts`: `armored = soaked < dmg * 0.5`). Tests that read `hit.armored` on a weak, resisted or marked armored enemy can disagree with the game.

Label: **confirmed** by trace.

Fix: capture the pre-armor `dmg` in a local, like the scene does.

## Negative results (checked, clean)

- **Set level 3 regression class.** No `=== 2` or `== 2` level checks remain. Every set gate is `c.tier >= 2` or `c.tier < 2` (content/sets), `sets.checkout >= 2` (`state/run.ts:392`), or `>= 1` (set events). `SET_L3` and `setCfg` from `handoff.md` no longer exist. Sets moved to `src/content/sets/*` in 701cf6a, so handoff.md is stale on this. The registry rejects any set tune array that is not exactly three finite numbers (`registry.ts:32,46`) and any bonus text that is not three entries (`registry.ts:184`). `lvOf` and `setLevels` return 0 to 3. `runPhase` and `runPlayerHooks` skip level 0.
- **Gold Star ★4.** `tuneValue` extends linearly past ★3. A scan of every array tune at ★4 found no NaN, no value at or below 0, and no sign flip. Values that pass natural bounds are clamped where they matter: Double Bag `Math.min(1, fraction)`, Tip Jar cap, Ice Pack cap. Can Opener's chance of 1.25 just means "always". The dash cooldown bottoms out at 3 - 1 (Night Shift) - 1.25 (Bell ★4) = 0.75 s.
- **Cooldowns and ticks.** Every cooldown change is multiplicative or a division by a value above 1 (Tools, Battery, Power Strip, TV Dinner). Every `BurnEffect` gets its tick from a tune of 0.5 (fuel, pool combos), so `tickBurn` and `tickPoison` cannot spin.
- **Set bonuses vs combos.** No combo or late-phase item assigns over `burn`, `popper`, `chainChance`, `range`, `aoe` or `cooldown` after the `set` phase. Grease Fire and TV Dinner multiply. Frost already sits at post-combo 1000.
- **Hooks.** `HOOK_NAMES` covers all 27 `HookEvents` keys. Item, combo and set ids are disjoint (checked over ITEM_ORDER and RECIPE_ORDER), so the per-owner `states` map and `otherTune` cannot collide. Ordering is `order`, then registration seq, as documented.
- **Status rules.** Burn, poison, slow, weaken, shred and wet all refresh to the later end and never stack. Weaken is capped at 0.5. Every slow source stays at or under its cap. Frost at L1/L2 adds +0.1 to a cap of 0.6, and the highest base is the Ice Pack cap of 0.6. Wet is capped at 0.7. Reactions are gated by the per-enemy cooldown, and reaction bursts never open a hit.
- **Tables.** `hpScale`, `dmgScale` and `total` rise monotonically over aisles 1 to 7. Overtime grows from aisle 7. Elite `chanceByAisle` has 7 entries for 7 regular aisles, and overtime falls back to `overtimeChance`. Every non-boss enemy appears in some wave mix, so `enemyAppears` never returns `first: undefined`.

## Mechanics notes (not bugs)

- Boss aisle 8 has `hpScale` 2.0 and `dmgScale` 1.7, below aisle 7's 2.3 and 1.8. This was intentional in c607c67 and only affects escorts.
- `setGains(type)` calls `setsOf(type)` without a flavor, so a Jelly Beans offer previews only its Snacks gain and never its element set gain (probe confirmed). This is low impact because the flavor rerolls per shop anyway.
- Popcorn is not in `PROJECTILE_PATTERNS`, so Multipack gives it +damage and Fan gives it reach. The popcorn file documents this as intended.

## Out of scope leads

- `handoff.md` describes `SET_L3`, `setCfg` and `=== 2` edits that the content-file refactor replaced. Anyone following it will look for code that no longer exists.
- `ArenaScene.stunEnemy` (`src/scenes/ArenaScene.ts:571`) sets `state = 'stun'` on a non-boss enemy in any state (tell, lunge, teleport) and keeps `max(stateT, dur)`. A stun on an enemy mid-tell can therefore last as long as the remaining tell.
