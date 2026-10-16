# Item hooks refactor: plan

Goal: every item, combo and set lives in its own file (data, numbers, text and behavior together), and the engine calls hooks. Changing an effect touches one file, and each file gets its own test.

Status: draft for approval. Based on the touchpoint inventory of 2026-10-16.

## 1. Why: what the inventory found

- An item's behavior is spread over **3–8 files** (toaster 8, sourdough 7, expiredmilk 7, ice 6, tinfoilhat 6, jellybeans 6; typical 4). The usual chain is `items.ts` → `synergies.ts` → `weapons.ts`/`ArenaScene.ts` → `ui/shop.ts` → `i18n`.
- `computeBuild` (`synergies.ts:13-163`) is pure (no RNG, no Phaser). That makes it easy to snapshot and safe to migrate first.
- Runtime code skips `WeaponStats` and reads the global store directly for many effects (`ArenaScene.ts` 586-1069, `weapons.ts` 424/599/631/645, `cartCombos.ts`). These reads must move into hooks.
- `damageEnemy` (`ArenaScene.ts:582-690`) carries about 20 item- and set-specific branches. It is the biggest blob.
- Combat randomness is **unseeded `Math.random`** (about 40 sites), so combat isn't reproducible in tests today.
- There is no physics engine. Collision is custom (`systems/obstacles.ts`), which is good for headless tests.
- Text and numbers drift: about 20 rules strings hard-code numbers (`items.ts`), recipe texts never read `RECIPE_TUNING`, and there's dead tuning (`BUFFS.bubbleArmor`, plus the comment at `ArenaScene.ts:590` saying +30% while the code uses 1.2).
- `tools/botrun.mjs` drives the real browser and isn't deterministic, so it works as a smoke test, not as a golden test.
- No snapshot tests exist. There are 265 assertion tests (`rules.test.ts`, `combo-balance.test.ts`, `batch1-3`, `crit-items`, `dash-items` cover effects).

## 2. Target layout

```
src/content/
  items/<id>.ts        one file per item (43)
  combos/<id>.ts       one file per combo (31)
  sets/<id>.ts         kitchen, cleaning, tools, snacks, checkout, heat, frost, blast, electric
  registry.ts          import.meta.glob collects everything and validates ids/requires
src/engine/
  define.ts            defineItem / defineCombo / defineSet + types
  build.ts             runs build hooks in phase order (replaces computeBuild internals)
  hooks.ts             runtime hook types + per-build compiled handler lists
  ctx.ts               narrow runtime API (see §5); Phaser adapter + fake for tests
  text.ts              renders rules/detail text and tier rows from `tune`
  patterns/<name>.ts   toast, sweep, burst, pulse, zap, aura, ricochet, puddle, laser, mortar, cone
```

`src/data/items.ts`, `recipes.ts` and `sets.ts` become thin re-exports from the registry during migration and are deleted at the end.

## 3. File shape

```ts
// src/content/items/fuel.ts
export default defineItem({
  id: 'fuel', kind: 'module', sets: ['tools', 'heat'], shape: '1x2', price: 11,
  unlock: 'starting',
  tune: { dps: [2.5, 3.75, 5], duration: 3, tick: 0.5 },   // arrays = per tier
  text: {
    en: { name: 'Fuel Can', blurb: 'Questionable. Sets every hit on fire.',
          rules: 'Adjacent weapons set enemies on fire: {dps}/s burn for {duration} s.' },
    de: { name: 'Benzinkanister', blurb: '…', rules: '…{dps}…{duration}…' },
  },
  build: {
    phase: 'module',
    weapon(w, c) { if (c.touches(w)) w.burn = maxBurn(w.burn, c.tune()) },
  },
});
```

```ts
// src/content/combos/greaseFire.ts
export default defineCombo({
  id: 'greaseFire', requires: ['mop', 'fuel'],
  tune: { radiusMult: 1.4, burnMult: 2 },
  text: { en: { name: 'Grease Fire', short: 'Huge burning slicks',
                detail: 'Puddles get {radiusMult|pct} bigger and burn ×{burnMult}.' }, de: {…} },
  build: { phase: 'combo', weapon(w, c) { w.aoe *= c.tune.radiusMult; if (w.burn) w.burn.dps *= c.tune.burnMult } },
});
```

Rules:
- **Text only uses `{key}` placeholders from `tune`**, with optional formatters (`|pct`, `|s`, `|x`). A lint test fails if a rules or detail string contains a bare number that isn't in `tune`. This kills the §1 bug class.
- **Tier rows (shop scaling table) are generated** from `tune` arrays, replacing `tierScaling` (`synergies.ts:222-260`).
- Declarative relations instead of code branches: `replaces: ['nailstorm']` (Ray Gun), `suppresses: ['fan']` (Mist Machine), `overrides: ['slow']` (Cold Storage, Brain Freeze).
- Shop metadata lives in the file: `shopBias` departments, `enhancedBy` (replaces the `ENHANCES` table at `shop.ts:19-29`), `starterGuarantee`.
- Variable footprint: `shape: (tier) => …` (Sourdough).

## 4. Hook list

### 4a. Build hooks (pure, no Phaser, run on every `recomputeBuild`)

Named phases replace `BUFF_ORDER` and the implicit ordering inside `computeBuild`. They encode today's order exactly (inventory §D):

| Phase | Today | Content |
|---|---|---|
| `base` | weapon defaults | pattern defaults, tier damage/cooldown |
| `module` | BUFF_ORDER loop :50-78 | fan, fuel, battery, ice, hotsauce, pricegun, tape, popper, echo (doublebag), multipack non-projectile dmg; sub-order kept via `order` |
| `flavor` | jelly :80-86 | jellybeans (uses max() against existing) |
| `global-mod` | :88-89 | sourdough, powerstrip, goldstar tier/bundle |
| `set` | :90-108 | set bonuses (kitchen dmg, cleaning range, tools cooldown, heat burn, bundle) |
| `combo` | applyRecipe :166-186 | all weapon combos |
| `post-combo` | :117-121 | multipack count, frost slow cap, fortune crit add |
| `final` | :123, :139-160 | perk mults, global player fields |

Hooks: `weapon(stats, c)`, `player(build, c)`, `shopWeight(offer, c)`, `price(p, c)`, `sellValue(v, c)`.

Context `c` (build): `tier`, `tune()`, `touches(weapon)`, `owned(id)`, `count(set)`, `cart`, `perk`.

### 4b. Run lifecycle hooks (pure state, no Phaser)

`onShopEnter(run)` (Sourdough rise, Jelly Beans reroll) · `onAisleEnd(run)` (checkout interest, future sell growth) · `onMerge(a, b)`.

### 4c. Combat hooks (Phaser-free via `ctx`)

The emit point for each one is where the inventory found it (§C):

| Hook | Emitted at | Users today |
|---|---|---|
| `onAisleStart` | `ArenaScene.create` :148 | Sugar Rush, Bag It, Expired Milk state |
| `onTick(dt)` | `ArenaScene.update` :923-967 | Milk aura, regen, Sugar decay, Tailwind |
| `pattern:<event>` | in each pattern | sweep (Chicken Dinner, Sizzling, Smash), explode (Pressure Point, Shrapnel), zap (TV Dinner, Sparks, Reheat), bounce (Confetti), shotHit (Frostbite, Ray Gun), beam (Power Surge, Price Check), pulse (Static Cling, Bag It), cone (Sour Mist, Tailwind), puddleEnter (Black Ice), aura (Smoothie Shield) |
| `modifyDamage(hit)` | `damageEnemy` :585-606 | Five-Alarm, mark ×1.2 (Flag, Price Check), crit roll |
| `onHit(hit)` | `damageEnemy` :618-668 | burn, ignite, slow, frost stun, knockback, echo, electric chain |
| `onCrit(hit)` | :593-606 | Clearance Sale coin, Free Sample heal |
| `onKill(kill)` | :670-681, `killEnemy` :752-809 | popper, blast pop, coupon, piggy, kitchen heal, Bag It charge |
| `onDashStart` | `updatePlayer` :1016-1032 | Sugar stack, Spare Wheel |
| `onDashHit(enemy)` | :1045-1054 | Boot dmg, Tip Jar, Sale Flag, tools stun, Express Checkout |
| `onDashEnd(landing)` | `dashLanding` :249 | Slam Bumper, Pot Slam |
| `onEnemyShotTouch(shot)` | `weapons.ts:631` | Tin Foil Hat reflect, Smoothie Shield |
| `onPlayerHit(dmg)` | `hurtPlayer` :890, `run.damagePlayer` :312 | Bubble Wrap armor and i-frames |
| `onCoinPickup` | `updateCoins` :844 | (future) |

Handlers are **compiled once per build** into flat arrays per hook, with only the cart's items included. That means no lookup per hit.

## 5. `ctx`: the narrow runtime API

Derived from inventory §E. Hooks never touch the scene directly.

- `now()`, `rng()` (**seeded per aisle**, replaces `Math.random` in effect code), `build`, `aisle` (electricRate, burn tuning, dept electricalRate, onIce)
- Enemies: `alive()`, `nearest(pos, r)`, `inRadius(pos, r)`, `damage(enemy, dmg, source, opts)`, `stun(enemy, s)`, `applyStatus(enemy, status)`
- Player: `player` (pos, facing, vel, radius, reflectT, dashT), `hurt(dmg)`, `heal(hp)`
- Spawning: `spawnShot(spec)`, `spawnPool(spec)`, `popperBlast(pos, dmg, r)`, `damageArea(pos, r, dmg, opts)`
- Economy: `dropCoin(pos, label)`, `addCoins(n, label)`
- Presentation (no-ops in the fake): `fx.*` (13 methods), `sound(name)`, `tween`, `delay(s, fn)`

Two implementations: `PhaserCtx` (wraps ArenaScene, Arsenal, fx) and `FakeCtx` (records calls, deterministic clock and rng) for tests.

## 6. Tests

- **Golden build snapshots (phase 0):** `computeBuild` output for about 40 carts (each item alone at ★1/★3 next to each weapon class, every combo, set L1-L3, Gold Star/Jelly/Sourdough/Power Strip edge cases) is serialized to JSON. These must stay byte-identical through the build migration.
- **Golden text snapshots:** rendered EN+DE rules/detail/tier rows for every item and combo. Drift is reviewed explicitly; the expected diffs are only the §1-style fixes.
- **Per-file tests:** `tests/content/items/fuel.test.ts` etc. Build asserts plus runtime asserts through `FakeCtx`.
- **Registry test:** ids unique, `requires` resolve, every placeholder exists in `tune`, no bare numbers in text, DE covers EN.
- **Existing 265 tests stay green** at every step.
- **Smoke:** `tools/botrun.mjs` runs after each runtime phase. Pass = no page errors.
- Combat is *not* fully golden-testable without a headless arena. The risk is covered by per-hook FakeCtx tests plus botrun plus manual play of each migrated combo in the Lab.

## 7. Phases

| # | Phase | Output | Gate |
|---|---|---|---|
| 0 | Safety net | commit current fixes; golden build + text snapshots; registry test skeleton | snapshots committed |
| 1 | Engine skeleton | `define.ts`, `registry.ts`, `build.ts` phases, `text.ts`; old code still runs | 265 green, golden identical |
| 2 | Migrate build-only items | modules + passives whose effect is build-only (fan, battery, hotsauce, pricegun, tape, magnet, lunchbox, bell, energy, fortune, piggy, snackbag, goldstar, powerstrip, sourdough, jellybeans…) | golden identical per batch |
| 3 | `ctx` + combat hook emit points | `PhaserCtx`, `FakeCtx`, seeded `rng`, emit hooks from ArenaScene/weapons with old branches still present | botrun clean |
| 4 | Migrate runtime items | fuel, ice, popper, doublebag, multipack, boot, bumper, sparewheel, tipjar, flag, coupon, bubblewrap, sample, expiredmilk, tinfoilhat | per-item FakeCtx tests, botrun |
| 5 | Sets | 9 set files; remove set branches from damageEnemy | golden + botrun |
| 6 | Combos | 31 combo files incl. cart combos (`cartCombos.ts` dissolves) | combo-balance test, Lab check |
| 7 | Patterns | 11 pattern files; weapons define `pattern` + params | botrun |
| 8 | Delete old | remove BUFFS/RECIPE_TUNING tables, applyRecipe, branches; `data/*` re-exports gone | everything green |

Phases 0, 1 and 3 run one at a time. **Phases 2, 4 and 6 split into parallel sessions** by file batch: each item and combo is its own file, and the registry glob means no shared list to edit.

New content (Wet, Shatter, Orbit, … and the new items/combos) is built directly on the new system after phase 6.

## 7b. Phase 1 learnings (read before migrating)

Phase 1 is done: the engine is in `src/engine/` and Hot Sauce is the pilot (`src/content/items/hotsauce.ts`). The goldens are identical.

- **Migrating an item means deleting all of its legacy pieces**: the `LEGACY_ITEMS` entry, the `BUFFS` entry, its `computeBuild` branch, its `tierScaling` row and its DE line in `data-de.ts`. Defining an item in both places throws at load.
- **Order lists:** `ITEM_ORDER` and `RECIPE_ORDER` drive shop rolls and recipe application. New content must be added there and to the id union type.
- **Import rule:** content files import only `engine/define`. Importing `data/items` creates a cycle.
- **Module hooks:** the content `order` must match `BUFF_ORDER` (fan 10 … multipack 100; a test checks this). A legacy `continue` becomes `return false`. Fan checks `c.matching.includes('mistMachine')`. Multipack splits into a `module` part and a `post-combo` count part.
- **Tier:** `c.tune()` extrapolates above ★3 linearly (Gold Star). Effects that aren't linear in tier (caps, `>= 3` thresholds, armor = tier) must use `c.tier`.
- **Non-module phases run once per owned item type.** Per-instance effects (Sourdough, Jelly Beans) loop over `c.touching(w)`.
- **Player hooks always run last.** Expired Milk's ×0.9 needs a high `order`, and the final `Math.round` on maxHp stays.
- **Still hand-edited per item:** the `describeBuffs` line, `STARTING_ITEMS`, `ENHANCES`, `STARTER_WEAPONS.guarantee` and `departments.shopBias`. These shop fields are typed in content but not read yet.
- **Combos:** some `RECIPE_TUNING` keys differ from the combo id (`greaseFireBoost`) and must be renamed or dropped by hand. Pressure Washer needs `tapeArc`, which isn't in `BuildCtx` yet.
- **Gold Star's** tier lift (`eff`) can't be expressed as a hook. Keep it legacy or give it a `set`-phase hook.
- **Not done yet:** the bare-number text lint (§6).

### Phase 2, batch 1 learnings (fan, fuel, battery, ice, pricegun, tape, popper, doublebag, multipack)

All nine moved; the module loop in `computeBuild` has no legacy branches left (it only dispatches to `runModule`). Goldens untouched.

- **Two hooks for one item:** `ItemContent.extraBuild?: BuildSpec[]` (never `module`) carries a second phase. Multipack uses `build` (module: damage) + `extraBuild` (post-combo: count and buff record).
- **Post-combo/non-module `c.tier` is the best copy in the whole cart, not the best copy touching the weapon.** Per-weapon effects that depend on the touching tier (Multipack count) must use `c.touching(w)` and `resolveTune(TUNE, tier)` (declare the tune as a `const TUNE = {...} as const` to reuse it). `module` is fine: it already gets the touching tier.
- **A hook that records its own buff** (`w.buffs.push(id)`) is only needed outside `module`; the module loop pushes it unless the hook returns `false`.
- **Not linear in tier, handled with a clamp or a flat key, never `c.tier`:** tape pierce `[1,1,2]` + `maxPierce: 2`; multipack extra shots `[1,1,2]` + `maxExtra: 2`; ice slow `cap: 0.6`; doublebag `Math.min(1, fraction)`. Everything else was linear and matches `TIER.mult(4)` exactly (checked per item in the tests at effective ★4).
- **Float rounding can change shop text:** `0.15 * 1.5` is `0.22499999999999998` (the shop shows 22%), a literal `0.225` shows 23%. Pricegun's ★2 is written `0.15 * 1.5` on purpose. Check `Math.round(x * 100)` ties when converting a base x `TIER.mult` into literals; the text golden catches it.
- **Content cannot import `data/items`:** `PROJECTILE_PATTERNS` now lives in `engine/define.ts` (data/items re-exports it). Other pattern lists (Multipack's `sweep/cone/mortar`) are local to the content file.
- **Runtime/other readers of old constants point at the ★1 content tune:** Jelly Beans and the Heat set's ignite read `contentTune('fuel'|'ice'|'popper', 1)` (full strength, scaled by their own factor); `ArenaScene` `ECHO_DELAY` and `weapons.ts` `MULTIPACK_REPEAT_DELAY` are module-level consts from `contentTune(..., 1)`. Phase 4 moves them into the hooks. `CRIT.mult` stays (it is the global crit multiplier, not Price Gun's).
- **Tests that read old constants must move too:** `tests/rules.test.ts` (battery) and `tests/crit-items.test.ts` (pricegun) now read `contentTune`. Expect the same for passives: `crit-items` (fortune, sample), `dash-items` (bumper, sparewheel, tipjar, flag), `rules.test.ts` (lunchbox, boot, snackbag, powerstrip).
- **Batch 2 (passives)** is done: see the next section (it replaces the earlier plan here). Its end has the refined batch 3 notes.

### Phase 2, batch 2 learnings (magnet, lunchbox, bell, energy, fortune, piggy, snackbag)

All seven moved; the goldens stayed byte-identical after each item. The `Build` literal in `computeBuild` now keeps only the non-item base (`PLAYER`, set bonuses, perk, Vacuum) for these fields; the items add to it from `player` hooks.

- **Pattern for a passive that edits a player field:** `build: { phase: 'final', player(b, c) { b.field += ... } }`. Player hooks run after the `Build` literal and before the Expired Milk x0.9 / `Math.round` on maxHp, in `order` (all seven are order-independent: they add or multiply onto different fields, or integers). `runPlayerHooks` runs a hook when `env.top(id) > 0`, with `c.tier = env.top(id)` = exactly legacy `gm`'s tier (whole-cart best copy, Gold Star included). So "does not stack" needs no code. The literal keeps the neutral base (`killCoinMult: 1`, `moveSpeedMult: perk.moveSpeedMult ?? 1`, `shoveCooldown: 3 + perk`); the hook does `+=`, `-=` or `*=`. Float order was checked: each field has at most two operands that commute, or dyadic values.
- **Fortune is a `post-combo` weapon hook** (`w.critChance += crit`), not `final`: legacy added it after the frost clamp, but nothing between reads `critChance`, so it is equivalent, and it runs after Price Gun's `module` assignment. A test covers the order (gun ★3 + Fortune ★3 = 0.4, not 0.1). `runPhase` for non-module phases uses `top()`, so Fortune hits every weapon in the cart with the best copy.
- **Rounding stays in the hook:** Magnet `Math.round(pickup)`, Lunchbox `Math.round(hp)`. The tune keeps the unrounded `[15, 22.5, 30]`, and the text/row formatter `+int` (`Math.round`) shows the same 23 as the legacy row. maxHp is only ever *added to* by Lunchbox/Snack Bag; the final round after Expired Milk stays in `computeBuild`.
- **Every one of the seven is linear in the tier** (`TIER.mult(4)` = continuation of the `[a, 1.5a, 2a]` tune), so `c.tune()` at Gold Star's effective ★4 is exact: magnet 150, lunchbox 37.5 -> 38, bell -1.25 s, energy +30%, fortune +12.5%, piggy x1.375. No caps (the `Math.min` caps are tipjar and coupon, batch 3+). Each is tested at an effective ★4 via `corner(...)` + `gilded(...)`.
- **Legendary (Snack Bag):** scalar tune only, no `rows` (the shop shows none for legendaries), and Gold Star never lifts it. Regen is written as `regenHp: 1, interval: 4` so the text reads "1 HP every 4 s" and the hook computes `regenHp / interval` = 0.25 exactly; do not store 0.25 and the 4 separately.
- **Text:** legacy rows used `t('rowMaxHp')` etc. (ui.ts). Content rows carry their own EN/DE label, copied from those strings; the `row*` keys in `i18n/ui.ts` that only these items used are now unused (`rowMaxHp`, `rowPickup`, `rowDashCd`, `rowMove`, `rowKillCoins`, `rowCrit`): delete them at phase 8. Formatters used: `+int`, `−s`, `+pct`, `+pct1` (Fortune, Piggy: `+7.5%`, DE `+7,5%`). **Blurbs are not rendered**: the Lunchbox blurb "+15 max HP." is a literal number and will drift if the tune changes (the bare-number lint should flag blurbs too).
- **`unlock: 'starting'`** is set for magnet, lunchbox, bell, fortune, piggy (they are in `STARTING_ITEMS`); energy and snackbag have unlock conditions that stay in `UNLOCKS` (no `unlock` field, as pricegun etc. did in batch 1).
- **No runtime or UI reader** of the removed constants existed (`BUFFS.magnetPickup`, `lunchboxHp`, `bellShove`, `energySpeed`, `fortuneCrit`, `piggyCoins`, `snackHp`, `snackRegen` were read only by `computeBuild`, `tierScaling` and tests). `BUFFS.vacuumPickup` stays (Vacuum is a weapon: it adds in the literal).
- **`tests/engine/build.test.ts` fixtures reuse real ids** (`fortune`, `piggy`, `lunchbox`, `magnet` as fake hooks). Once those ids became real content, the legacy `+0.05` / `+15` the test relied on vanished; the expectations now only count the fixture hook. When batch 3 moves `powerstrip` and `jellybeans` (also fixtures there), expect the same.
- **Shared test helpers** (`tests/content/helpers.ts`): `full(specs, perk)` is the whole build of an 8x6 cart, `far(type, tier)` puts a passive anywhere not touching the weapon, `corner(type, tier)` puts it at (6,4) so `gilded(index)` can reach it without touching the weapon (a Gold Star next to a passive that sits at the scan's first free cell would touch the weapon).
- **Batch 3 (powerstrip, sourdough, jellybeans, goldstar), refined from reading `computeBuild` after batch 2:**
  - *Order inside the loop matters here, unlike batch 2.* Legacy order per weapon: module loop, `flavor` hook, **Jelly Beans loop**, `global-mod` hook, **Sourdough loop**, **Power Strip line**, `set` hook, set bonuses (tools `cooldown /= 1.08` ...), Bundle Deal. A content `global-mod` hook runs *before* the Sourdough and Power Strip lines, so these two cannot just sit in `global-mod` with their current neighbours still legacy: move them together (Sourdough first, then Power Strip, in `order`) and delete both legacy lines at once, or the cooldown divisions (`/= 1.4` then tools `/= 1.08`) and damage multiplications (`*= 1 + 0.06 * eff`, then Bundle `*= 1 + 0.06 * bundle`) change order. All of them are plain multiplications/divisions of different stats, so the final values match, but float order is not free: check with the goldens and use `toBeCloseTo` only where the legacy test did.
  - *Power Strip* is a **legendary module** (`kind: 'module'`, no `buff`, `electrical: true`, family tools, 3x1). Weapon hook: only for `c.def(w.type).electrical` weapons, `cooldown /= c.touches(w) ? adjacent : all`. The text is hard-coded today ("+20% ... +40%") while the code divides by 1.2 / 1.4: put the divisors in the tune (`all: 1.2, adjacent: 1.4`, bit-exact division) and add `allGain: 0.2, adjacentGain: 0.4` for the text, with a test that `1 + gain === divisor`. Gold Star never lifts a legendary. `tests/rules.test.ts:597-601` reads `BUFFS.powerstripAll/Adjacent`: point at `contentTune`.
  - *Sourdough*: `s.damage *= 1 + perStar * eff(n)` per touching instance, i.e. linear through **zero** (`perStar * tier`), not through ★1 like the `[a, 1.5a, 2a]` tunes. Do not use a per-tier array for it: use a scalar `perStar: 0.06` and multiply by the instance's own effective tier from `c.touching(w)[i].tier` (not `c.tier`, which is the cart-wide best). The row is `pctUp(perStar * tr)` = `+6% / +12% / +18%`, so it needs a `rows` entry whose values are arrays: add a tune key `damage: [0.06, 0.12, 0.18]` for text/rows and keep `perStar` for the hook, or compute the hook from `damage` per tier. `SOURDOUGH.every` and `rise` are read by `state/run.ts:263-272` and `tests/batch3.test.ts:7,89`: keep the constant (or a `contentTune('sourdough', 1).every`) and repoint those readers; its growing footprint (`shape: (tier) => ...`) is separate from the build hook.
  - *Jelly Beans* (`flavor`): the hook loops `c.touching(w)`; per instance `m = TIER.mult(tier) * strength` and `flavorOf(instance)` (it is in `data/sets`, content cannot import it: pass the instance's `flavor` through `instance.flavor`, with the same default as `flavorOf`; check what that default is first). It `max()`es against what the `module` loop left and reads `contentTune('fuel'|'ice'|'popper', 1)`: content importing `engine/registry` is not allowed (only `engine/define`), so the hook needs those three tunes through `BuildCtx` (add something like `c.tuneOf(id, tier)`) or the loop stays legacy-sized until then. Its legacy loop sits after the module loop and the `flavor` runPhase, before `global-mod`; keep the phase `flavor`. `JELLY.strength` has one reader (the row `Math.round(strength * mult * 100)%`).
  - *Gold Star*: `eff()` is the `BuildEnv` and cannot be a hook; the item can still move (text, tune, the +1 Bundle Deal item). That +1 is the `s.bundle = nearTypes.size + (nearTypes.has('goldstar') ? 1 : 0)` line, which runs after the `set` phase; as a hook it must sit at the end of `set` (use `order` high) and compute from `c.touches(w)` before the `s.damage *= 1 + BUNDLE.perItem * s.bundle` line, which stays legacy. It is a legendary module: scalar tune, no rows.
  - Repoint tests that read these constants (`tests/rules.test.ts`, `tests/batch3.test.ts`) and the `tests/engine/build.test.ts` fixtures that reuse `powerstrip`/`jellybeans` ids.

## 8. Risks

- **Order changes silently alter numbers.** Mitigation: the named phases mirror §D exactly, and the golden snapshots catch any drift.
- **Runtime behavior can't be fully golden-tested.** Mitigation: FakeCtx tests, botrun, Lab play per batch.
- **Seeded rng changes the "feel" of randomness.** Distributions stay the same; this only affects reproducibility.
- **Hot path performance** (hundreds of hits per second). Mitigation: precompiled handler arrays, no allocation per hit in the fake-free path.
- **Big-bang temptation.** Each phase is mergeable on its own; old and new paths coexist until phase 8.

## 9. Open decisions

1. The text formatter syntax (`{dps|pct}`). Fine, or something else?
2. Should sets also become content files in this refactor (as planned in phase 5), or later?
3. Should the seeded combat rng be per aisle, from the run seed (daily runs become fully reproducible)?
