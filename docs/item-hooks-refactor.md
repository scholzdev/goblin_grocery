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

**Damage pipeline order (`ArenaScene.damageEnemy`, phase 3).** Hooks slot in before the legacy lines of their step, so moving legacy lines into hooks top to bottom never reorders anything:

1. `modifyDamage` (pre-crit, pre-armor; multiply `hit.dmg`), then legacy ×Five-Alarm (burning toast), then legacy ×mark (Price Check / Sale Flag).
2. Crit roll (combat rng): ×`CRIT.mult`, `onCrit`, then legacy Clearance coin and Free Sample heal.
3. Armor (direct hits only), `hp -= dmg`, `damageByWeapon`.
4. `onHit`, then legacy statuses: burn, ignite, slow, frost stun, knockback, flash and number fx, Double Bag echo, electric chain.
5. On a lethal hit: `killEnemy` (loot) then `onKill`, then legacy Bag It, kitchen heal, blast pop, Party Popper.

Five-Alarm (×1.5) comes before the mark (×1.2) today, so both must move into `modifyDamage` together (or Five-Alarm first) with `order` 10 and 20; moving only the mark would swap the multiplication order (an ulp, not a gameplay change).

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
| 2 | Migrate build-only items **(done, 3 batches)** | modules + passives whose effect is build-only (fan, battery, hotsauce, pricegun, tape, magnet, lunchbox, bell, energy, fortune, piggy, snackbag, goldstar, powerstrip, sourdough, jellybeans…) | golden identical per batch |
| 3 | `ctx` + combat hook emit points **(done)** | `PhaserCtx`, `FakeCtx`, seeded `rng`, emit hooks from ArenaScene/weapons with old branches still present | botrun clean |
| 4 | Migrate runtime items **(done. Batch 1: fuel, ice, popper, doublebag, coupon, sample. Batch 2: boot, bumper, sparewheel, tipjar, flag, bubblewrap, expiredmilk, tinfoilhat; the vacuum pickup stays a `computeBuild` literal until phase 7; multipack's repeat is phase 7)** | per-item FakeCtx tests, botrun |
| 5 | Sets **(done)** | 9 set files in `src/content/sets/`; set branches gone from `computeBuild`, `damageEnemy`, `onHitStatuses`; new `afterHit` / `afterKill` hooks; interest and puddle slow still read the set tune | golden + botrun |
| 6 | Combos **(done)** | 31 combo files in `src/content/combos/` incl. the cart combos; `cartCombos.ts` is gone (runtime in combo hooks, the status lines in `scenes/playerOverlay.ts`); `RECIPE_TUNING`, `applyRecipe` and the legacy recipe tables are gone; 31 combo sims `?sim=combo-<id>` | golden + combo-balance + botrun + sims |
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

### Phase 2, batch 3 learnings (powerstrip, sourdough, jellybeans, goldstar)

All four moved; the goldens stayed byte-identical after each step (pair first, then Jelly Beans, then Gold Star). **Phase 2 is complete**: the weapon loop of `computeBuild` has no item-specific branch left; what remains in `computeBuild` is the set bonuses, Bundle Deal, the legacy combos (`applyRecipe`, phase 6) and the `Build` literal fields of the runtime items (phase 4: vacuum pickup, boot, bumper, sparewheel, tipjar, flag, coupon, bubblewrap, sample, tinfoilhat, expiredmilk).

- **Sourdough + Power Strip moved together**, both in `global-mod` (`order` 10 and 20). With both legacy lines gone, `runPhase('global-mod')` is followed directly by `runPhase('set')`, so the order is exactly the legacy one: Sourdough damage, then Power Strip cooldown. Jelly Beans (`flavor`) was moved on its own afterwards; its legacy loop sat right after `runPhase('flavor')`, so the position is unchanged.
- **Sourdough**: scalar `perStar` (hook: `1 + perStar * n.tier` per `c.touching(w)` instance) plus `damage: [PER_STAR * 1, * 2, * 3]` for text and the shop row, both from one `const`. `every` (aisles per rise) and `cellsMid`/`cellsMax` (derived from the shapes, for the text) live in the tune. `shape: (tier) => SHAPES[tier - 1]`; `cellsFor` only reads the content shape now (the `SOURDOUGH_CELLS` table is gone). `riseSourdough` in `state/run.ts` reads `contentTune('sourdough', 1).every` at call time (a test mutates the tune and sees the growth follow). `SOURDOUGH` is deleted.
- **Power Strip**: `all: 1.2, adjacent: 1.4` for the code, `allGain`/`adjacentGain` (= the divisor minus 1, from the same consts) for the text. `BUFFS.powerstrip*` deleted.
- **`tierMult` and `flavorOf`/`FLAVORS` moved into `engine/define.ts`** (content may only import it). `TIER.mult` is now `tierMult`; `data/sets` re-exports `flavorOf`; `state/run.ts` reads `FLAVORS` (and `FLAVORS.length` instead of the literal 3 in the roll). Jelly Beans needs `TIER.mult(tier) * 0.7` to the bit, so it keeps a scalar `base` (hook) and a `strength` row array (text only); `tuneValue`'s linear continuation above ★3 would not be bit-exact (`0.7 * 1.5` is `1.0499999999999998`).
- **`BuildCtx.tuneOf(id, tier)`** (generic): another content item's tune resolved at a tier, `{}` for a legacy item. Jelly Beans reads Fuel/Ice/Popper at ★1 through it. Tested in `tests/engine/build.test.ts` (fixture hook) and through the real Jelly Beans tests. Content still never imports the registry.
- **Jelly Beans reroll stays in `run.ts`** (`rollFlavors`, `newFlavor`) but reads the flavor list from `define.ts`; `setsOf` in `data/sets` still special-cases `type === 'jellybeans'` for the flavor-as-element rule (a content `flavored` flag would make it generic; phase 5 when sets move).
- **Gold Star: option (a), declarative.** `ItemContent.tierBoost?: { key, excludes: ('weapon' | 'legendary')[] }`, `key` = a positive scalar tune entry (validated in `registry.ts`). `engine/build.ts` `tierBoostOf(placed)` returns the per-instance lift: the largest boost among touching boosters (so two stars never add up, no chaining because the booster's own kind is excluded as a legendary), nothing for excluded kinds. `computeBuild`'s `eff` is `tierOf(i) + boost(i)` and `describeBuffs` uses the same helper (it had its own copy of the star check). Small (about 20 lines) and generic: another item can lift neighbors with one field. The Bundle +1 is a `set`-phase hook (`order: 100`, `w.bundle += c.tune().bundle` when it touches the weapon); `computeBuild` now does `s.bundle += nearTypes.size` instead of assigning, and the hook runs before it (phase `set` is dispatched ahead of the legacy set bonuses). The `BUNDLE.perItem` multiplier stays in `computeBuild` (Bundle Deal is a general rule). When sets move (phase 5), keep Gold Star's hook before the multiplier.
- **Text**: Gold Star's "one tier higher" is a word; only `★{maxTier}` (= `3 + tiers`) and `+{bundle}` are placeholders. Blurbs are still literal.
- **Fixtures**: `tests/engine/build.test.ts` still reuses `powerstrip`/`jellybeans` ids as fake hooks; it still works because the mocked registry replaces `contentItems()`. The `tierBoost` table is built from `contentItems()` too, so under that mock there is no Gold Star lift (nothing in that file uses one).
- **Next (phase 3/4)**: `rowStrength` in `i18n/ui.ts` is unused now (delete at phase 8, like the batch 2 `row*` keys); `rowDamage` is still used by weapons.

### Phase 3 learnings (ctx, runtime hooks, seeded combat rng)

Phase 3 is done: the runtime hook infrastructure and its emit points are in, **no item is migrated**, and the legacy branches still do all the work. Goldens untouched; with no runtime content hooks registered the game plays as before, apart from the rng stream.

**Files.** New: `engine/hooks.ts` (payload types, `HookCtx`, `compileHooks`, `hookSourcesFor`, `buildHooks`, `EMPTY_HOOKS`), `engine/ctx.ts` (`RuntimeCtx`, `FxApi`, the `Combat*`/`PlayerView` views), `engine/fakeCtx.ts` (`FakeCtx`), `scenes/phaserCtx.ts` (`PhaserCtx`), `tests/engine/{hooks,ctx,rng}.test.ts`. Changed: `engine/define.ts` (`hooks?: RuntimeHooks` on `ItemContent`/`ComboContent`/`SetContent`, `HOOK_NAMES`; `RuntimeHooks` used to be mixed into the content type itself), `engine/registry.ts` (`checkHooks`: unknown hook names, non-functions and a non-finite `order` fail at load), `systems/rng.ts` (`combatSeed`, `combatRng`, `COMBAT_SALT`), `ArenaScene.ts`, `weapons.ts`, `enemies.ts`, `events.ts`, `hazards.ts`.

**Declaring a hook.** `hooks: { order?: number, onHit(hit, ctx, c) {...}, 'pattern:sweep'(ev, ctx, c) {...} }`. `c` is a `HookCtx`: `tier`, `tune()` (resolved once per compile, one frozen object, no allocation per call), `touches(weaponUid)`, `owned(id)`, `state` (scratch, shared by that owner's hooks, fresh per aisle) and `id`/`kind`. `order` positions all of one owner's hooks (default 0; ties by registration: items, then combos, then sets, each in registry order). Item tier = the best effective copy in the cart, Gold Star lift included (same as the build hooks' `c.tier` outside `module`); a combo's tier is 1, a set's is its level. Item `touches` includes the item's own uid (a weapon item's hooks see itself). A combo `touches` only its own weapon (`null` weapon list for cart combos = every weapon).

**Hook list and payloads** (`engine/hooks.ts`; the fields are the final ones):

| Hook | Event |
|---|---|
| `onAisleStart` | `{ aisle, boss, department, modifier }` |
| `onTick` | `dt` (a number: no object per frame) |
| `modifyDamage`, `onHit`, `onCrit` | `HitEvent { enemy, base, dmg, stats, opts: HitOpts, source, now, direct, crit, armored, killed }`; `dmg` is writable in `modifyDamage` (pre-crit, pre-armor) and `onCrit` (already ×`CRIT.mult`); in `onHit` it is what was dealt; `killed` = this hit took the enemy to 0; `direct` = not a DoT tick, echo, popper blast or chained hit; `HitOpts` is the old `damageEnemy` `opts` verbatim (`fromPopper`, `chained`, `echo`, `isDot`, `quiet`, `poison`, `blow`, `kb*`, `label`) |
| `onKill` | `{ enemy, hit: HitEvent \| null }` (credited kills only, always from `damageEnemy`) |
| `onDashStart` / `onDashHit` / `onDashEnd` | `{ x, y, dx, dy, reach, chained }` (`chained`: a free Spare Wheel dash) / `{ enemy, dx, dy, dmg }` / `{ x, y, dx, dy, hit }` |
| `onEnemyShotTouch` | `{ shot, damage, handled }`: set `handled` to stop the shot hurting |
| `onPlayerHit` | `{ dmg, invuln }`, both writable (armor, i-frames); runs after the i-frame / guard checks |
| `onCoinPickup` | `{ label, streak }` |
| `pattern:sweep` | `{ stats, stage: 'before' \| 'after', x, y, angle, bonus, range, dmg, hits }`; `before` may edit `range`/`dmg` |
| `pattern:explode` | `{ stats, x, y, hits }` |
| `pattern:zap` | `{ stats, stage, link, target, damageMult, hits }`; `before` may edit `damageMult` |
| `pattern:bounce` | `{ stats, shot, x, y, next }` |
| `pattern:shotHit` | `{ stats, shot, enemy }` |
| `pattern:beam` | `{ stats, stage, target, angle, echo, targets, hits }`; `before` has the unhurt `targets` (marks go here) |
| `pattern:pulse` / `pattern:cone` / `pattern:aura` | `{ stats, x, y, inside }` / `{ stats, x, y, angle, hits }` / `{ stats, x, y, range, hit }` |
| `pattern:puddleEnter` | `{ stats, enemy, puddle, first }` |

The lifecycle hooks of §4b (`onShopEnter`, `onAisleEnd`, `onMerge`) are still only typed.

**Compiled dispatch.** `ArenaScene.create` calls `rebuildHooks()` after `arsenal.setBuild` (the build cannot change inside an aisle: crates go to the shelf; call `rebuildHooks()` if that ever changes). `scene.hooks` is a `HookTable`: one readonly array per hook name plus `emit(name, ev)`, `hit` (true while any of modifyDamage/onHit/onCrit/onKill has a handler) and `size`. **Every emit site guards with `hooks.<name>.length` (or `H.hit`) before building the payload**, so with nothing registered an emit is one property read and a length check: no object, no call. Emit sites that need collections (`hits`, `inside`, the zap/sweep/beam events) allocate them only when someone listens. Keep that pattern for new emit points.

**Where each hook is emitted** (ArenaScene.ts / weapons.ts, current line numbers): `onAisleStart` ArenaScene:181 (combat phase only, after the banner) · `onTick` :989 (inside the combat-phase block, after regen) · `modifyDamage` :629 · `onCrit` :640 · `onHit` :661 · `onKill` ArenaScene:799 (batch 1 moved it from the end of `killEnemy` to right after the regular coins and the bread drop, before the Pickpocket loot, Splitter/Melon spawns and the boss callbacks; credited kills only) · `onDashStart` :1077 · `onDashHit` :1103 (right after the shove damage) · `onDashEnd` :268 (`dashLanding`, first line) · `onPlayerHit` :942 (`hurtPlayer`, before `damagePlayer`; Bubble Wrap armor itself still lives in `run.damagePlayer`) · `onCoinPickup` :928 · `onEnemyShotTouch` weapons:666 (before the legacy Tin Foil reflect) · `pattern:sweep` weapons:474 (`before`) / :494 (`after`) · `explode` :394 · `zap` :282 / :292 · `bounce` :633 · `shotHit` :615 · `beam` :227 / :234 · `pulse` :538 · `cone` :337 · `puddleEnter` :444 · `aura` :252.

**FakeCtx** (`engine/fakeCtx.ts`): `new FakeCtx({ seed, aisle, build, hp, maxHp, ... })` with a manual clock (`advance(s)`, `tick(dt)` also emits `onTick`), the arena's rng (`combatRng(seed, aisle)`), an in-memory enemy list (`spawnEnemy`), hostile shots, and a `calls` log (`callsOf('stun')`, ...). `damage` records and then runs the same hook-visible pipeline as the scene (modifyDamage, crit roll, onCrit, hp, onHit, onKill); `hit(enemy, dmg, stats?, opts?)` runs it without recording (use it as "the weapon hit"). `ignite`/`slow`/`poison`/`mark`/`stun` record **and** apply to the in-memory enemy; `popperBlast` damages with `fromPopper`; `hurt` honors i-frames and `onPlayerHit`; `delay`/`tween` run when the clock reaches them. `attach(table)` wires compiled hooks in. Test pattern: `buildHooks(cart, build.recipes, build.sets, fake)`, `fake.attach(table)`, drive, assert. **Not simulated**: everything the scene still does outside hooks (the legacy Five-Alarm / mark multipliers, armor, status application from `stats.burn/slow`, knockback, echo, chain). An item's test only sees its effect once the legacy branch is gone.

**PhaserCtx** (`scenes/phaserCtx.ts`): a field-by-field forwarder to `damageEnemy`, `stunEnemy`, `popperBlast`, `hurtPlayer`, `dropCoin`, `arsenal.spawn/firePool/reflect/kill`, `fx`, `play`, `tweens`, `time`. The only logic is `damageArea` (a loop), `heal` (clamped add) and `ignite` (runs the burn through `aisleEvent.burn`, like the weapon branch). `Arsenal.spawn`/`firePool`/`reflect` and `ArenaScene.healHeartFx`/`wave` went from private to public for it.

**Seeded combat rng.** `combatRng(runSeed, aisle)` (`systems/rng.ts`) = mulberry32 of `(runSeed ^ salt) * golden + (aisle + 1) * c ^ salt`; the scene creates it as the first line of `create()` (`scene.rng`, `scene.rngBetween(min, max)`, `ctx.rng()`). It never touches `flow.rng`, and no `flow.rng` call site changed, so shop rolls, spawn plans, kill coins and bread keep their exact sequences. A daily run now rolls the same combat numbers on every play. The rng is per aisle (recreated each `create`), so restarting an aisle replays it.

- **Changed to `rng()`** (all gameplay-affecting): ArenaScene crit roll, Heat ignite chance, Frost stun chance, Electric chain chance, Kitchen heal, Blast pop, Coupon (`coinChance`), Tip Jar (`dashCoinChance`), `dropCoin` scatter (angle, speed, height), Splitter and Melon spawn angle, lab dummy position (`rngBetween`); weapons.ts nail spread, Sparks Fly stun, Shrapnel angle, Smash the Bank, Static Cling target shuffle; enemies.ts `pickAffix` (now takes the rng), first attack cooldown, Expired Milk blink timer and angle, boss slush / ring attack angles; hazards.ts timed-hazard jitter; events.ts Wet Floor patch positions, Power Surge zap position and side.
- **Left as `Math.random` / `Phaser.Math.Between`, on purpose** (cosmetic: no outcome depends on them): particles and flames (`fx.*`, `fx.ts`), sound pitch (`play(..., { rate })`), the sweep fx spin direction, sprite wobble (`animT`), the crit / echo / death fx jitter, the jagged shape of the electric arc, the heatwave puffs. `tests/engine/rng.test.ts` fails if a new `Math.random` line in the arena files doesn't look cosmetic (an `fx.`, `play(`, `animT` or `rotation:` on the same line).
- **Left on `flow.rng`, on purpose**: spawn plan, spawn timing and picks, elite rolls, kill-coin counts and chance, bread drops, mini-boss variant, boss summons, crates, event and modifier rolls, Wet Floor streak layout, stockroom layout. They already use a seeded stream; moving them would shift every later shop roll. Revisit at phase 8 if a fully separate stream is wanted. `flow.ts` seeding itself is unchanged (`Date.now() ^ Math.random()` for non-daily runs).

**Notes for phase 4** (one runtime item = move its legacy lines into `hooks`, delete the legacy branch, keep the rng draw order, add a FakeCtx test):

- Build-literal fields the hooks replace (`computeBuild`'s `Build` literal and `describeBuffs`) go in the same step, or the old field stays and the hook reads `ctx.build`. Prefer deleting the field.
- **Fuel / Ice** (burn / slow application; *superseded: batch 1 moved the application into `engine/onHitStatuses.ts`, see the phase 4 batch 1 section*): `stats.burn` / `stats.slow` are WeaponStats fields set by the *build* hook and applied in `damageEnemy` (lines right after `onHit`). Moving the application means an `onHit` hook: `ctx.ignite(hit.enemy, burn)` / `ctx.slow(hit.enemy, slow)`, reading the burn from `c.tune()` (tick, dps scaled by the weapon's `stats`) instead of `stats.burn`. But Jelly Beans, the Heat set (ignite), Grease Fire, Reheat and the puddles read `stats.burn` too, so move the *application* only after those readers stop needing it, or keep `stats.burn` as the data and make the hook a thin applier (recommended: hook `onHit` applies `hit.stats.burn`; no data move). `ignite`'s `aisleEvent.burn` modifier is inside `ctx.ignite`.
- **Popper** (`onKill`; *superseded: `engine/onKillEffects.ts`*): `if (hit.stats?.popper && !hit.opts.fromPopper) ctx.popperBlast(enemy, stats.popper)`. Order is already legal: `onKill` runs before the legacy kitchen / blast lines, but legacy ran popper *last*; the draw order is unchanged (popper uses no rng), the visual order is not important. Blast set L2 (phase 5) stays legacy until then.
- **Double Bag** (`onHit`; *superseded: `scheduleEcho` in `engine/onHitStatuses.ts`*): `hit.stats.echo > 0 && hit.direct` then `ctx.delay(ECHO_DELAY, () => ctx.combatActive() && enemy.alive && ctx.damage(enemy, hit.base * stats.echo, stats, { echo: true, quiet: hit.opts.quiet }))`. Use `hit.base` (the incoming damage), as the legacy line does with `baseDmg`.
- **Multipack** repeat is in `weapons.ts` (`MULTIPACK_REPEAT_DELAY`), not in `damageEnemy`: it is a pattern-side repeat, not one of these hooks. Leave it until phase 7 unless it needs `onAisleStart`/`onTick` state.
- **Boot** (`dashHit` extra damage via `build.shoveDamage`) / **Tip Jar** (coin chance, `ctx.rng()`) / **Sale Flag** (`ctx.mark(enemy, c.tune().duration)`) / **Tools-set stun** / **Express Checkout**: all `onDashHit` (Express Checkout: `onDashEnd` with `ev.hit`, it calls `arsenal.expressCheckout`; add a ctx method or keep the call in the scene). Boot's damage is added to the dash hit itself: `build.shoveDamage` is read when the scene calls `damageEnemy`, so either keep it a build field or give the dash hit a `modifyDamage` (`hit.opts.label === 'shove'`).
- **Slam Bumper / Pot Slam** (`onDashEnd`): `ev.x/ev.y`; Bumper's shockwave is `ctx.damageArea({x,y}, r, dmg, null, { kb: 200, label: 'Slam Bumper' })` plus `ctx.fx.ring`; Pot Slam is `arsenal.dashBlast` (needs a ctx method, or a `pattern:explode` source).
- **Spare Wheel** (`onDashStart`): the free-chain window is decided by the scene *before* the emit (`p.chainT`, `ev.chained`); the hook can only observe it today. To move it, let the hook set `player.chainT` / `player.shoveCd` (both on `PlayerView`, writable) and move the `shoveCd`/`chainT` assignment after the emit.
- **Flag** (Price Check / Sale Flag mark): application is `onDashHit` (`ctx.mark`); the ×1.2 multiplier is the `modifyDamage` slot (see the pipeline order). Price Check is a combo (phase 6): move the multiplier together with Five-Alarm then.
- **Coupon** (`onKill`; *done in batch 1, and the emit moved earlier*): `hit` is credited; `ctx.rng() < c.tune().chance` then `ctx.dropCoin(enemy, label)`. Replaces the `coinChance` Build field. Legacy order: after bread, before Pickpocket loot (the `onKill` emit now comes after the loot; coin order differs, the count does not).
- **Bubble Wrap** (`onPlayerHit`): `ev.dmg = Math.max(1, ev.dmg - c.tier)` (armor = tier, see §7b phase 1) and i-frames via `ev.invuln`. Delete `run.damagePlayer`'s `armor` read; keep the final hp clamp there.
- **Free Sample** (`onCrit`; *done in batch 1*): the heal is capped per whole second (`critHealSec` / `critHealed` scene fields): move that counter into `c.state`; `ctx.heal` + `ctx.fx.spark`. Clearance Sale's `critCoin` coin is the same slot.
- **Expired Milk**: the toxic aura is `cartCombos.update` (reads `build.stinkDps`): `onTick` with `ctx.inRadius(player, r)` and `ctx.poison(e, dps, dur)`; the ×0.9 max HP stays a build hook.
- **Tin Foil Hat** (`onEnemyShotTouch`): `if (p.reflectT > 0) { ctx.reflectShot(ev.shot, c.tune().mult); ev.handled = true }`; `reflectT` is set by the dash code (`TINFOIL.grace`), so also make the dash code's `reflectT` an `onDashStart` + `onTick` hook, or keep that line legacy.
- **Vacuum pickup**: `vacuumPickup` is a pickup-radius *build* field (`computeBuild` literal), not a combat hook; it moves with the weapon (phase 7) as a `player` hook.
- `Blast L2` / `Kitchen L2` / `Heat L2` / `Frost L2` / `Electric` rolls in `damageEnemy` already draw from `rng()`; when they move (phase 5) keep the draw order: crit, ignite, frost stun, electric chain, kitchen heal, blast pop.
- **Every hook that rolls must call `ctx.rng()`** (never `Math.random`); FakeCtx tests seed it, so assert on exact outcomes with a fixed seed or on `rng` call counts.
- **Gotchas found while building this**: (1) the same `HitEvent` object travels through `modifyDamage`, `onCrit`, `onHit` and `onKill`; its `dmg` is the *current* damage at each stage. (2) Echo and chained hits re-enter `damageEnemy`, so every hit hook runs again for them (`hit.direct` / `hit.opts.echo` / `hit.opts.chained` tell them apart). (3) `onKill` is not emitted for uncredited kills (end-of-aisle cleanup, escapes, Egg Carton blast). (4) A damaging hook must pass `fromPopper` / `chained` / `echo` in `opts` to avoid re-triggering itself.

### Phase 4, batch 1 learnings (fuel, ice, popper, doublebag, coupon, sample)

All six are done; `tests/golden` is byte-identical (checked after every step), `tsc`, `vitest run` (twice) and `vite build` are green.

**The design rule: `WeaponStats` fields are a contract with several writers, so applying them is engine behavior, not item behavior.** `burn` (Fuel, Jelly Beans heat, Heat-set ignite, Grease Fire), `slow` (Ice, Jelly frost, Cold Storage, Brain Freeze, Frost set), `popper` (Party Popper, Jelly blast, Blast set radius), `echo` and `ignite` are written by build hooks of many sources and read in `damageEnemy`. Two Phaser-free modules now hold that code, working on the `HitEvent` through `RuntimeCtx`:

- `src/engine/onHitStatuses.ts`: `applyHitStatuses(hit, ctx)` (burn via `ctx.ignite`, Heat L2 ignite roll + flames/ring, slow via `ctx.slow`, Frost L2 freeze roll + stun + `frozenT` + frost sound) and `scheduleEcho(hit, ctx)` (Double Bag; the 0.12 s delay is `contentTune('doublebag', 1).delay`, the module-level const that used to live in ArenaScene). `ArenaScene.damageEnemy` calls them at the same pipeline positions as the lines they replace: `applyHitStatuses` right after `onHit` (ArenaScene:655), `scheduleEcho` after the number fx and before the Electric chain (:678).
- `src/engine/onKillEffects.ts`: `applyKillEffects(hit, ctx)` = the Party Popper blast (:706), still the last line of the lethal branch, after Bag It, the Kitchen heal and the Blast-set pop.
- `FakeCtx.runHit` calls the same functions at the same positions, so a test with a real `computeBuild` cart sees burn, slow, freeze, echo and the popper blast without any item hook. `tests/engine/onHitStatuses.test.ts` and `onKillEffects.test.ts` cover refresh vs stack, the stronger slow wins, the Frost L2 conditions (needs 35% slow, L2, direct hit, no aura/puddle/DoT, bosses stun but never freeze), ignite only without a burn, echo skipped for echo/DoT/popper/chained, popper never chains, and the draw order.
- **`hit` is built on every `damageEnemy` call now** (one small object; it was `null` unless a hit hook was registered), because the engine modules read it. The emits are still guarded by `H.hit` / `list.length`, so a cart without hit hooks still calls nobody.
- The rule for the remaining sets and combos (phases 5/6): their stats-driven bits (Electric chain, Kitchen heal, Blast pop, Bag It) are set/combo behavior, not item behavior, and move as set/combo hooks, not into an item.

**Items with no runtime hook (a correct outcome).** Fuel Can, Ice Pack, Party Popper and Double Bag have no item-id or item-only branch at runtime: the build hook already sets the stats field, the engine applies it. Their content files gain no `hooks`; each test file got a "runtime" block that asserts `hooks` is undefined and that the effect lands through the engine (burn at the tier's dps, slow pct, blast damage, echo share after the delay).

**Coupon Book and Free Sample** are fully migrated: def, tune, EN+DE text, rows, the legacy `LEGACY_ITEMS` entries, `BUFFS.couponChance/sampleHeal/sampleHealCap`, the two `tierScaling` rows and the DE lines are gone, the `computeBuild` branches are gone. The golden text and build snapshots did not move.

- **The `Build` fields stay.** `coinChance` and `critHeal` are serialized by `tests/golden/__snapshots__/build.json`, so they cannot be deleted. They are set by `player` hooks (`phase: 'final'`, `b.coinChance += min(cap, chance)`, `b.critHeal += heal`; the `computeBuild` literal now has `0`) and **nothing reads them at runtime**: the runtime hooks read their own `c.tune()` (cap included, through one shared local function in coupon.ts), so the hook is testable without a build. Delete both fields and the two player hooks when the golden contract is retired (phase 8).
- **Coupon** is `onKill`: one `ctx.rng()` roll per credited kill, then `ctx.dropCoin(enemy, ctx.t('coinCoupon'))`. The tune is `chance: [0.3, 0.3 * 1.5, 0.3 * 2]` (the exact legacy float for ★2) and `cap: 0.9` (flat).
- **Free Sample** is `onCrit`: `c.state.sec` / `c.state.healed` replace the scene's `critHealSec` / `critHealed` (state is fresh per aisle, like the old reset in `create`), heal = `min(heal, cap - healed, maxHp - hp)` via `ctx.heal` + `ctx.fx.spark`, no heal while `ctx.player.dead`. Tune: `heal: [1, 1.5, 2]`, `cap: 2` (flat, so the rules text reads "{cap} HP per second"). Sample's `onCrit` runs before the legacy Clearance Sale coin; the two do not share state or rng, so the order is free.
- **`RuntimeCtx.t(key, vars?)`** (new): a UI string in the current language, for coin labels (`ctx.t('coinCoupon')`). Content may not import i18n. `FakeCtx.t` returns the real string, so tests assert the label the player sees (EN `Coupon Book`, DE `Gutscheinheft`). Use it for `coinTip` (Tip Jar), `coinClearance` and any other label.
- **`tests/content/helpers.ts: arena(specs, fakeOptions?, perk?)`** returns `{ fake, b, inv, stats }`: the real build of a cart and a `FakeCtx` with its compiled hooks attached; `fake.hit(enemy, dmg, stats)` is "the weapon hit". Use `{ ...stats, critChance: 1 }` to force a crit, and `combatRng(seed, 0)` in the test to predict the draws (the fake's rng is the arena's).

**Rng draw order: unchanged.** Same number of draws in the same order within a hit: crit roll, Clearance coin (dropCoin: 3 draws), then in `applyHitStatuses` the ignite roll (only without a burn, direct hits) and the Frost freeze roll (only when its conditions hold; both short-circuit before drawing exactly like the legacy condition), then the Electric chain, killEnemy (coins/bread use `flow.rng`; the Coupon roll sits after the bread drop), Kitchen heal, Blast pop. Echo, burn, slow and the popper blast draw nothing. **One placement change was needed to keep it:** the `onKill` emit moved from the end of `killEnemy` to right after the bread drop (where the Coupon roll lived), so the roll still comes before the Pickpocket loot drops and the Splitter/Melon spawn angles. At the old place the draw order would have shifted for those kills. Past Coupon, no `onKill` hook exists yet; a hook that needs to see the boss/mini-boss callbacks done or the loot dropped should be a new emit point rather than moving this one again. Tested: the coupon test checks that the stream after n kills is exactly n draws further.

**Cosmetic randomness in the engine modules:** the ignite flame jitter and the echo pop position use `Math.random` on `ctx.fx.*` lines (as `Phaser.Math.Between` did); `tests/engine/rng.test.ts` only scans the scene files, so keep such lines on an `fx.` call.

**Notes for phase 4, batch 2** (*done, see the "Phase 4, batch 2 learnings" section below; kept for the reasoning*) (boot, bumper, sparewheel, tipjar, flag; bubblewrap, expiredmilk, tinfoilhat, vacuum pickup). The `Build` fields these items own (`shoveDistMult`, `shoveDamage`, `dashSlam`, `dashChain`, `dashCoinChance`, `dashMark`, `armor`, `invulnBonus`, `reflectMult`, `stinkDps`, `pickupRadius`) are in the golden build snapshot, so the same rule as Coupon/Sample applies: a `player` hook sets the field (keep its value bit-exact; Tip Jar and Gold Star caps via `Math.min` in the hook), and decide per field whether the scene still *reads* it:
  - *Read by scene code that is not a hook:* `shoveDistMult` (ArenaScene:1040, 1058-1059: dash reach and speed), `shoveDamage` (:1070, the damage of the dash hit itself), `shoveCooldown`/`dashChain` (:1044), `invulnBonus` (:909, `hurtPlayer`), `armor` (`state/run.ts:315`, `damagePlayer`), `reflectMult` (`weapons.ts:668/676`), `stinkDps` (`cartCombos.ts:90`), `pickupRadius`. These stay build fields the engine reads (they are the contract, like `burn`); the item only sets them.
  - *Item-specific runtime branches that move into hooks:* Tip Jar's coin roll (:1073) -> `onDashHit` with `ctx.rng()` and `ctx.t('coinTip')`, Sale Flag's mark (:1072) -> `onDashHit` with `ctx.mark(enemy, seconds)` (it writes `markedUntil` today; the ×1.2 multiplier in `damageEnemy` is Price Check's, phase 6), Slam Bumper (`dashLanding`, :265-271) -> `onDashEnd` with `ctx.damageArea` + `ctx.fx.ring` (the radius `BUFFS.bumperRadius` becomes a tune key), Spare Wheel (:1044) needs the `chainT` assignment moved after the `onDashStart` emit (see the Spare Wheel note above), Tin Foil Hat (`weapons.ts:668`) -> `onEnemyShotTouch` and its `reflectT` grace (:1054) as `onDashStart`/`onTick` (or keep that line), Expired Milk's aura (`cartCombos.update`) -> `onTick` with `ctx.inRadius` + `ctx.poison`, Bubble Wrap -> `onPlayerHit` (`ev.dmg = max(1, ev.dmg - c.tier)`, `ev.invuln += tune`), which means deleting the `armor` read in `run.damagePlayer` *and* the `invulnBonus` read in `hurtPlayer`; if the field must stay for the golden, the hook sets it and nothing reads it.
  - *Check each runtime branch for an id-specific read first.* Batch 1 found four of six items had none; the dash items and Bubble Wrap are the opposite (every one has a scene branch keyed on its own build field). Boot is the one that may have none: `shoveDistMult`/`shoveDamage` are consumed by the dash itself, so Boot is only a `player` hook (plus its text/rows) and gets no runtime hook, like Fuel.
  - Labels: `ctx.t('coinTip')`. `onDashHit` is emitted right after the shove damage (:1071), before the legacy mark and Tip Jar lines; the mark draws no rng, so the only draw in that block is Tip Jar's, and Flag/Tip Jar can be moved in either order. The Tools-set stun and the Express Checkout call are other legacy lines of the dash and stay until phase 5/6.
  - Vacuum pickup is a *weapon* effect (it adds `BUFFS.vacuumPickup` in the `computeBuild` literal): a `player` hook in vacuum's content file at phase 7, or a literal that stays.
  - Remaining generic-engine candidates for the same extraction as batch 1: none in these items. The next stats-driven extraction is `knockback` (`opts.kb`, Cleaning L2) if the dash items need it, and it is set behavior (phase 5).
  - Unused after batch 1/2: the ui keys `rowCritHeal`, `rowCoin` (batch 1), plus `rowCoin`-like `rowTip`, `rowMark`, `rowSlam`, `rowChain`, `rowArmor`, `rowReflect`, `rowPoison`, `rowDashDist`, `rowDashDmg` when those rows move; delete at phase 8.

### Phase 4, batch 2 learnings (boot, bumper, sparewheel, tipjar, flag, bubblewrap, expiredmilk, tinfoilhat)

All eight are now content files (`src/content/items/<id>.ts`) with their EN+DE text, tune and rows; their `LEGACY_ITEMS` entries, `BUFFS` keys (`bootDistance` ... `bubbleInvuln`), `EXPIRED_MILK`, `TINFOIL`, `tierScaling` rows and DE lines are gone. `tests/golden` is byte-identical (checked after the whole batch and `git diff --stat tests/golden` is empty). The vacuum pickup was **not** moved (see below).

**Per item.**

| Item | Hook | What it replaced |
|---|---|---|
| Running Boot | none (`player` build hook only) | `shoveDistMult` / `shoveDamage` are read by the dash itself, so it is like Fuel: a build field is the whole contract |
| Slam Bumper | `onDashEnd` | the `dashSlam` block in `dashLanding` (sound, ring, one `damage` per enemy in `90 + radius`, knockback away from the landing point) |
| Spare Wheel | `onDashStart` | `p.chainT = build.dashChain` (see the scene change below) |
| Tip Jar | `onDashHit` | the coin roll after the shove damage (`ctx.rng()`, `ctx.t('coinTip')`) |
| Sale Flag | `onDashHit` | `e.markedUntil = now + dashMark` (`ctx.mark`) |
| Bubble Wrap | `onPlayerHit` | `run.damagePlayer`'s `armor` read and `hurtPlayer`'s `invulnBonus` read |
| Expired Milk | `onTick` | the poison loop in `cartCombos.update` (the cloud drawing stays there, see below) |
| Tin Foil Hat | `onDashStart` + `onTick` + `onEnemyShotTouch` | the reflect branch in `weapons.ts` and the `reflectT` line in `updatePlayer` |

**Decisions that differ from the batch 2 notes (re-checked against the code).**

- **The Flag's x1.2 stays in `damageEnemy`, it did not move into a `modifyDamage` hook.** A mark has two writers, the dash (Flag) and the Price Check beam (`weapons.ts`: `e.markedUntil = ...`), and the multiplier is `RECIPE_TUNING.priceCheck.damageMult` for any marked enemy. A Flag-owned hook would drop the bonus for a Price Check cart without a Flag. So it is engine behavior like `burn`/`slow` (design rule of batch 1): Flag only *applies* the mark. It leaves the pipeline untouched: Five-Alarm, then mark, then crit (guarded by the existing order test and by `flag.test.ts`, which also pins `1 + tune.bonus === RECIPE_TUNING.priceCheck.damageMult`, the number the Flag text shows). When Price Check moves (phase 6), the multiplier moves with it into a `modifyDamage` hook that is shared by both writers (e.g. a `marked` status in the engine), Five-Alarm at `order` 10 and the mark at 20.
- **The Spare Wheel needed no emit move.** The `onDashStart` emit already sits after the cooldown assignment. The scene now does `chainT = 0` on every dash (a chained dash uses the window up, a normal one closes the old window) and `shoveCd = cooldown` on a normal dash, then emits; the hook sets `chainT = window` when `!ev.chained`. Same result as before for every case (also a normal dash taken while the old window is still open). A source-scan test pins the reset-before-emit order and that nothing reads `build.dashChain` any more.
- **Tin Foil Hat owns `player.reflectT` completely.** The old line (`if (shoveT > 0) reflectT = grace; else reflectT -= dt`, at the top of the dash block, so on the *last* dash frame it still sets the grace) became `onDashStart` (opens it) + `onTick` (emitted right after `updatePlayer`). `onTick` cannot look at `shoveT` for "was dashing at the start of the frame" (it is already decremented), so the hook keeps `c.state.dashing`: true from `onDashStart` until the first tick that sees `shoveT <= 0`, and while it is true the tick sets `reflectT = grace`. `tinfoilhat.test.ts` runs a frame-by-frame model of the old line against the hook (even frames, uneven frames, a wall stop, a second dash).
- **Bubble Wrap: the armor read is deleted from `run.damagePlayer`** (now `hp -= amount`). Behavior is identical because every damage to the goblin goes through `ArenaScene.hurtPlayer`, which emits `onPlayerHit` before `damagePlayer`, and the hook computes `max(1, dmg - armor)` with the same tier (`c.tier`, Gold Star included, best copy). The i-frame bonus is `ev.invuln += 0.25` starting from `PLAYER.invuln` (same sum, same float). `Build.armor` / `Build.invulnBonus` are still set (golden contract) but nothing reads them. `tests/rules.test.ts` no longer expects armor from `damagePlayer`; the armor tests live in `bubblewrap.test.ts` through `FakeCtx.hurt`, which mirrors `hurtPlayer` (and no longer reads `build.invulnBonus`).
- **Expired Milk splits the aura in two.** The poison (every 0.5 s, 1 s of poison, `inRadius` of the goblin) is the `onTick` hook with a `c.state.t` countdown that reproduces the old `stinkT` exactly (starts at 0 so the first frame fires, restarts at the interval with no carry-over, does not run while the goblin is dead). The cloud *drawing* and the sparks stay in `cartCombos.update`, keyed on `build.stinkDps > 0` and reading the radius from `contentTune('expiredmilk', 1).radius`; drawing is not item logic and the Graphics object lives in the scene. Frame-order note: `onTick` is emitted earlier in the frame than `cartCombos.update` (before the enemy update instead of after), so a poison tick lands one enemy-update earlier; not visible in play.
- **Expired Milk's curse is a high-order player hook.** `b.maxHp *= 1 - hpCut` at `order: 100` (after Lunchbox and Snack Bag), and `computeBuild` keeps only `build.maxHp = Math.round(build.maxHp)`. `1 - 0.1` is exactly `0.9`, so it is bit-identical to `Math.round(total * 0.9)`. `tests/engine/build.test.ts` has a fixture hook for it now (its mocked registry drops the real one).
- **The Tools set's dash-damage multiplier moved after the player hooks.** The legacy literal was `(6 + boot + perk) * toolsMult`; Boot is a player hook now, so the literal is `6 + perk` and `computeBuild` multiplies `shoveDamage` by the set's `shoveDamageMult` right after `runPlayerHooks`. All operands are dyadic, so the golden stays identical. When the Tools set moves (phase 5) that line goes with it (a `final` player hook at `order` above Boot's).
- **Slam Bumper loops `ctx.inRadius` instead of `ctx.damageArea`** because every enemy needs its own knockback direction (`kbX/kbY` away from the landing point). Condition: `inRadius` uses `d^2 <= (r + radius)^2` where the scene used `hypot(...) > r + radius`; the same except for an enemy exactly on the boundary (an ulp). Order inside the emit is unchanged: sound, ring, damage, and then the scene's Pot Slam `dashBlast` right after the emit.
- **Vacuum pickup: not moved.** `+60` is `BUFFS.vacuumPickup` in the `computeBuild` literal (`has('vacuum')`), read only by the generic pickup radius. Nothing at runtime is keyed on the vacuum, so there is no hook to write, and moving only the number would need a content file for the Vacuum *weapon* (its pattern, shape, rules text) that phase 7 builds anyway. It becomes a `final` player hook of the Vacuum content file then.

**API additions: none.** `RuntimeCtx`/`PhaserCtx`/`FakeCtx` already had everything (`sound`, `fx.ring`, `inRadius`, `damage`, `mark`, `poison`, `reflectShot`, `dropCoin`, `t`, `player.chainT/reflectT`). Only `FakeCtx.hurt` changed (it dropped the `build.invulnBonus` read, like `hurtPlayer`).

**Pipeline / order changes: none** in `damageEnemy`. Draw order unchanged (Tip Jar's roll is still the only `rng()` call in the dash-hit block; Flag draws none). Guards: the `damageEnemy` order test (unchanged), `flag.test.ts` (Five-Alarm < mark < crit, the shared multiplier), `sparewheel.test.ts` (reset before emit), `bubblewrap.test.ts` (`onPlayerHit` before `damagePlayer`, no armor/invulnBonus reads left), `tinfoilhat.test.ts` (frame model, no `reflectT` writes or `TINFOIL` in the scene, the handled flag).

**Patterns worth reusing in phase 5 (sets) and 6 (combos).**

- **A build field that stays for the golden snapshots** (`dashSlam`, `dashChain`, `dashCoinChance`, `dashMark`, `reflectMult`, `stinkDps`, `armor`, `invulnBonus`): a `final` player hook sets it from the tune, the runtime hook reads its own tune, nothing reads the field. Every one of the batch 2 fields is in that state except `stinkDps` (it still gates the cloud drawing) and `shoveDistMult`/`shoveDamage` (read by the dash).
- **Runtime hooks that need a timer or a phase** keep it in `c.state` (fresh per aisle): Expired Milk's countdown, Tin Foil's `dashing`, Free Sample's counters. Any state that models a *scene* variable must copy the scene's exact frame order; a model test (the old logic as a few lines of test code, compared frame by frame) is cheap and caught the "last dash frame" case.
- **A hook that rolls** (`ctx.rng()`) is tested by predicting the draws with `combatRng(seed, aisle)`; one assertion that the stream after n events is exactly n draws further proves "no extra draws" for every ordering question.
- **For a set that changes a shared field** (Tools: `shoveDamage`, `shoveStun`, cooldown; Checkout: price; Snacks: max HP): put its hook at an `order` that matches the legacy position relative to the item hooks (items add first, a set that multiplies a *total* goes last, a set that adds goes anywhere). The Tools L2 multiplier is the one open example.
- **For combos** (phase 6): Price Check owns the mark multiplier (see above) and, with the Flag, the only `markedUntil` writers; Pot Slam (`arsenal.dashBlast` right after the `onDashEnd` emit) is the combo that sits next to the Bumper, so it can be an `onDashEnd` hook of its own (needs `ctx` access to `dashBlast`, or a `pattern:explode` source) and keeps running after the Bumper's because combos register after items; Sparks Fly / Ray Gun (Tin Foil Hat as a support) need nothing from the hat's hooks, they read the weapon stats.
- **Test files**: each of the eight has a build block (legacy formula to the bit at tiers 1-3 and Gold Star's effective ★4, no stacking), a runtime block and a content block (registered def, tune, order, EN+DE text, rows). The 3x1 Bubble Wrap does not fit `corner()` (6,4) in the 8x6 cart: use `at(type, tier, { near: [], apart: [0], at: [5, 4] })` for wide items.
- **Unused after batch 2** (delete at phase 8): the ui keys `rowSlam`, `rowChain`, `rowTip`, `rowMark`, `rowArmor`, `rowReflect`, `rowPoison`, `rowDashDist`, `rowDashDmg`; `Build.dashSlam/dashChain/dashCoinChance/dashMark/armor/invulnBonus/reflectMult` once the golden contract is retired.

### Phase 5 learnings (sets)

Nine set files `src/content/sets/<id>.ts` (`defineSet`): kitchen, cleaning, tools, snacks, checkout, heat, frost, blast, electric. Each colocates its tune (L1/L2/L3 arrays), EN/DE text (`name`, three `bonus` rows rendered by `renderText` with the set tune, so `setBonus(id, lv)` and `tagT(id)` read the registry), its build hook and its runtime hooks. `data/sets.ts` keeps only counting (`setsOf`, `setCount`, `setLevels`, `setGains`, `lvOf`) plus the re-exports of `SET_ORDER` / `SET_THRESHOLDS` (now in `engine/define.ts`). `SETS`, `SET_L3` and `setCfg` are gone; non-hook readers use `contentSetTune(id, level)` (registry). The 54 `set_*` ui keys and the set names in `DATA_DE.tags` were deleted; the goldens did not move.

**Engine additions.**

- Two new combat hooks, `afterHit` (`HitEvent`, after `applyHitStatuses`, before the kill check) and `afterKill` (`KillEvent`, after `onKill` and Bag It, before `applyKillEffects`). The existing `onHit` / `onKill` sit before the status code and the kill effects, so the set rolls could not use them without moving the rng draw order. `HitEvent.kbMult` (starts at 1; the knockback line ends with `* hit.kbMult`) lets Cleaning scale the knockback from a hook. Both emits are guarded by `H.afterHit.length` / `H.afterKill.length`.
- `HookCtx.def(id)` (read an item def, used by Heat for Fuel's burn), `RuntimeCtx.ricochetTarget(from, seen, range)` (a `pickRicochetTarget` wrapper; `ctx.nearest` has different tie, range and Honey Jar rules, so the Electric chain needs its own) and `RuntimeCtx.arcFx(points)`. FakeCtx has all three.
- `SetContent.extraBuild`: a second list of `BuildSpec`s, flowing into ALL entries of `computeBuild` (the same list the player hooks live in). A set whose bonus has two build positions (Tools: cooldown in `set`, dash damage as a `final` player hook) uses it.
- `ItemContent.flavored` (Jelly Beans only; the registry requires `sets.length === 1`): `setsOf` takes the flavor as the element for such an item instead of testing `type === 'jellybeans'`. `ItemDef.flavored` is copied by `itemDefOf`.
- Number-only formatters `pctn` (`10`), `pctup` (`(v-1)*100`), `pctdown` (`(1-v)*100`) for the set rows that embed a percentage inside prose.
- `SET_ORDER` (the legacy iteration order, which also fixes the registration order of the sets) and `SET_THRESHOLDS = [2,3,4]` in `define.ts`. The registry checks that the set ids equal `SET_ORDER`.

**Order decisions (all golden-verified).**

| Set | Position | Why |
|---|---|---|
| kitchen, cleaning, tools, heat, blast, electric | `set` phase, orders 10, 20, 30, 40, 50, 60 | the legacy branch order, and all after Gold Star's Bundle hook (order 100 belongs to the item phase, before the set bonuses) |
| snacks, checkout | `final` player hook, order 10 | they set `maxHp` / `priceMult` directly, which are not weapon stats; `b.maxHp += maxHp` stays an integer add before the Boot hooks' float work |
| tools dash damage | `final` player hook, order 200 (via `extraBuild`) | **the Tools multiplier choice**: legacy was `(6 + boot + perk) * mult`. Boot is a `final` player hook at a lower order, so a hook at order 200 sees the full sum and multiplies it, exactly the legacy value. Any item that adds to `shoveDamage` has to stay below 200 |
| tools stun | same hook sets `shoveStun` (kept for the goldens); the runtime stun is an `onDashHit` hook | `shoveStun` is no longer read by the scene |
| frost slow clamp | `post-combo`, order 1000 | the legacy clamp ran after the combos; 1000 is above any combo hook |
| frost freeze | `afterHit`, order 20 | in the old `applyHitStatuses` the freeze was the second roll after the ignite; the ignite stays there, so freeze is the first `afterHit` roll |

Runtime hook orders: kitchen heal `afterKill` 10, blast pop `afterKill` 20 (kitchen first, as in the legacy line order), cleaning `afterHit` 30, frost `afterHit` 20, electric `afterHit` 40, tools `onDashHit` 10. The draw order stays crit, ignite, frost freeze, electric chain, kitchen heal, blast pop; the `damageEnemy` pipeline marker test in `onHitStatuses.test.ts` now uses `afterHit` / `afterKill` markers, and each set test proves "no extra draws" with `combatRng`.

**Semantics kept on purpose.**

- **Heat's ignite roll stays in `onHitStatuses.ts`** (it writes `stats.burn` and the status object, part of the stats contract that the Fuel hook and the scene share); only the Heat build hook (burn extension, the ignite stat from Fuel's tune for heat weapons without a burn) moved. Frost's freeze moved because it is a pure `afterHit` consequence.
- **Heal popup quirk**: `ArenaScene.healHeartFx` reads `contentSetTune('kitchen', 1).heal` (legacy read `setCfg('kitchen', 1)` for the popup text), so it shows 3 at Kitchen L3 although 4 is healed. Not fixed (behavior-neutral refactor). Same for the Confetti Cannon blast radius in `weapons.ts`: it reads the Blast tune at level 1, so the L3 radius multiplier is ignored (the `build` hook already scales the popper at the set's own level).
- **Leftover set-tune readers outside hooks**: `weapons.ts` puddle slow (`applySlowFx` with the Frost tune) and the Confetti radius; `state/run.ts` `finishWave` interest (Checkout, `contentSetTune('checkout', lv)`). The interest wants an `onAisleEnd` run hook; that is a run-lifecycle hook that does not exist yet. `tests/content/sets/migration.test.ts` greps the source for leftover set branches and allows exactly these two files.
- Chain jump targets use `ctx.ricochetTarget` (inclusive range, a later enemy wins a tie), copied from `pickRicochetTarget`.

**Tests.** `tests/content/sets/<id>.test.ts` for each set (threshold behavior at L0..L3 with the tune, EN/DE text, the build fields against the legacy formula, FakeCtx runtime hooks incl. the rng draw counts), `helpers.ts`, `migration.test.ts`; registry tests for set validation (id = filename, unique ids, placeholders, hook names, `extraBuild`, `flavored`) and for the real registry (nine sets, tune triples, rendered bonuses, orders); `text.test.ts` has the three new formatters.

**Notes for phase 6 (combos).**

- Combos use the same dual path: a `combo` / `post-combo` build hook for the stats plus a runtime hook; the registration order is items, sets, combos, so a combo hook ties after an item/set hook of the same order.
- Price Check owns the mark multiplier and Pot Slam goes through `onDashEnd` (see the batch 2 notes above); Pot Slam needs `dashBlast` from `ctx` or a `pattern:explode` source. Express Checkout is the remaining legacy dash line.
- A combo that needs a set level reads `c.sets` in its build hook. The Frost clamp at post-combo 1000 means a combo that changes the slow must stay below it.
- Unused after phase 5 (delete at phase 8): the ui `row*` keys listed above, `Build.shoveStun` (the only set-written field with no reader but the goldens; `regen` is read by the scene and `priceMult` by `systems/shop.ts`, so they stay), and the legacy-shaped `SetId` string unions in `types.ts` once `SET_ORDER` drives the type.

### Phase 6 learnings (combos)

31 combo files `src/content/combos/<id>.ts` (`defineCombo`), each with its recipe (`requires`, weapon first; `cart: true` for Sugar Rush), scalar tune, EN/DE text (name, short, summary, detail; the `rows` of the old table went with them), the `combo`-phase build hook where the combo changes stats, and the runtime hooks. `data/recipes.ts` keeps only `RECIPE_ORDER` (the legacy iteration order, it fixes the registration order), `RECIPES` (the legacy `RecipeDef` converted from the content, for the code that still reads that shape), `recipeParts`, `recipeIcon`. `RECIPE_TUNING`, `recipeTuningOf`, `applyRecipe`, the DE `recipes` table and `RECIPES`-in-i18n are gone (`DATA_DE.recipes` is built from the content, `recipeT` throws for a combo without a file). `src/scenes/cartCombos.ts` is deleted: its three jobs are now (a) combo hooks (Bag It, Sugar Rush, Tailwind, Express Checkout), (b) the engine pieces `engine/stacks.ts` and `engine/marks.ts`, (c) `scenes/playerOverlay.ts` (the status lines and the Expired Milk cloud, nothing combo-specific).

**Where each combo lives now** (`b` = build phase `combo` in RECIPE_ORDER; hook orders only where not 0).

| Combo | Build (`combo` phase) | Runtime hook |
|---|---|---|
| toastMode | b: count 3, damage x0.75, spread 22 | none (cosmetic `recipes.includes` reads in weapons.ts) |
| nailstorm | b: pierce +1, homing | none; the homing turn and range are read from the combo tune in weapons.ts (phase 7) |
| coldStorage, brainFreeze | b: frost ring / range, **slow** (`overrides: ['slow']`) | none |
| expressCheckout | b: flag `expressSweep` (golden contract) | `onDashEnd` order 10: per-pan 1 s ICD in `c.state.last`, `ctx.sweep(uid, angle, true)` |
| tvDinner | b: chain +1, cooldown x0.92 | `pattern:zap` before: link > 0 -> `damageMult` 0.6 |
| clearanceSale | b: bounces +2, flag `critCoin` | `onCrit`: one coin per enemy (`critCoinDropped`) |
| greaseFire | b: range x1.4, burn dps x2 | none |
| pressurePoint | b: flag `firePool` | `pattern:explode` -> `ctx.spawnPool` |
| mistMachine | b: arc / range (`suppresses: ['fan']`) | none |
| fiveAlarm | none | `modifyDamage` order 10: toast vs burning x1.8 |
| sizzlingSkillet | none | `pattern:sweep` after: 3 pools |
| chickenDinner | none | `pattern:sweep` before: every 4th sweep, range x1.4 / dmg x2.5 (`c.state.sweeps`) |
| frostbiteNails | b: pierce +1 | `pattern:shotHit`: every 3rd hit per enemy stuns 0.7 s |
| staticCling | none | `pattern:pulse`: shuffle `[...inside]` with `ctx.rng`, 3 zaps |
| reheat | none | `pattern:zap` before, link 0: pool at the target |
| smoothieShield | none | `pattern:aura`: `killShot` inside the range |
| confettiCannon | none | `pattern:bounce` -> `ctx.popperBlast` (Blast set radius via `c.tuneOf('blast')`) |
| blackIce | none | `pattern:puddleEnter` first: stun 0.8 s |
| shrapnel | none | `pattern:explode`: 6 nails (one rng jitter each) |
| pressureWasher | b: arc = 25 + `c.tapeArc`, range x2, damage x2.5 | none |
| powerSurge | none | `pattern:beam` before: first beam `ctx.delay(0.25)` -> `ctx.beam(uid, target, true)`; the echo sets `damageMult` 0.25 |
| potSlam | b: flag `dashBlast` | `onDashEnd` order 0: `ctx.explode(uid, x, y)` per weapon |
| priceCheck | none | `pattern:beam` before: `ctx.mark` each target; the x1.2 itself is `engine/marks.ts` |
| sugarRush (cart) | none | `onDashStart` pushes a stack, `onTick` keeps the `speedMods` entry and the "SUGAR ###" line in step |
| smashBank | none | `pattern:sweep` 'hit' stage: one rng roll per damaged enemy, `dropCoin` |
| bagIt | none | `onKill` charge + `setLine`; `onDashStart` drops the bag (`fx.garbageBag`, `ctx.delay(fuse)`) |
| sourMist | none | `pattern:cone` -> `ctx.poison` on `ev.hits` |
| sparksFly | b: chain +2 | `pattern:zap` order 10: before = last 2 links x0.5 (overrides TV Dinner's 0.6), 'hit' = stun roll |
| rayGun | none (`replaces: ['nailstorm']`) | `pattern:fire` (bolt, `handled`) + `pattern:shotHit` (ring + splash) |
| tailwind | none | `pattern:cone`: `speedMods.tailwind`, `windUntil`, feeds Sugar Rush via `c.stateOf` |

**Engine additions.**

- New events/stages: `pattern:fire` (`FireEvent`, a handler that fires something instead of the default nail sets `handled`); `SweepEvent` and `ZapEvent` get a `'hit'` stage with `enemy` (fired right after each enemy's damage, so Smash the Bank's and Sparks Fly's rolls interleave with the enemies' own draws as before); `ZapEvent.damageMult` / `BeamEvent.damageMult` (editable in `before`; start at 1).
- `HookCtx.tuneOf(id, level?)` (an item by tier, a combo, or a set by level) and `HookCtx.stateOf(id)` (another owner's scratch state, undefined if it is not in the cart; states are pre-created per owner so the order of registration does not matter). Used by Tailwind (Sugar Rush stacks and tune) and Confetti (Blast radius).
- `BuildCtx.tapeArc`: the arc Duct Tape added before the combos (`WeaponEnv.tapeArc`, set by `synergies.ts` right before the combo loop), so Pressure Washer keeps the legacy `25 + tape` and Mist Machine's arc cannot leak in.
- RuntimeCtx: `sweep(uid, angle, bonus?)`, `explode(uid, x, y)`, `beam(uid, target, echo?)` (re-enter the pattern code for one weapon: `Arsenal.weaponOf(uid)`), `boltFx(x, y, small)`, `setLine(id, text|null, order?)`; `FxApi.garbageBag`; `CombatShot.splash` (Ray Gun); `PlayerView.speedMods` (`id -> (now) => multiplier`; the speed formula multiplies them in key order, then `playerSlow()` and gum). All in `PhaserCtx` and `FakeCtx` (new call kinds sweep, explode, beam, boltFx, line, plus `fake.lines`).
- `engine/stacks.ts` (pure: `liveStacks`, `countStacks`, `pushStack`, `tailwindFeedsSugar`; `systems/combat.ts` re-exports `tailwindFeedsSugar` for the old tests) and `engine/marks.ts` (`MARK_MULT` = Price Check's tune, `markedDamage`, called by `damageEnemy` and `FakeCtx.runHit` right after the `modifyDamage` hooks; Sale Flag marks too). `registry.contentComboTune(id)` for the pattern code that still needs a combo's numbers.

**Order decisions (all golden / draw-order verified).**

- Damage pipeline: `modifyDamage` (Five-Alarm, order 10) -> mark rule -> crit roll -> `onCrit` (Free Sample, then the Clearance Sale coin) -> armor / hp -> `onHit` ... The comment on `damageEnemy` is renumbered 1..6, and a source-order test pins it (`tests/content/combos/order.test.ts`).
- Slow: Cold Storage / Brain Freeze set the slow in the `combo` phase, Frost L1 adds +0.1 in `post-combo` order 1000 (0.5 -> 0.6, 0.4 -> 0.5), pinned in the test.
- Multipack's count is `post-combo`, after Toast Mode's `count = 3`.
- Dash end: Pot Slam (order 0) before Express Checkout (order 10), as the two legacy lines. Express Checkout is the only combo with its own ICD state; the timestamp is per pan.
- Sparks Fly vs TV Dinner: both set `damageMult` in `pattern:zap` before; Sparks Fly is order 10 so its 0.5 on the last two links wins, TV Dinner's 0.6 stays on the earlier chain links.
- The Static Cling shuffle keeps `[...inside].sort(() => rng() - 0.5)` over a copy: the exact comparison count (and so the rng draws) is the legacy one. Shrapnel draws one jitter number per fragment, in fragment order.
- Ray Gun's bolt is every `every`th shot **per weapon uid** (`c.state.shots`), the legacy per-weapon counter.

**Semantics kept on purpose (deviations from "clean").**

- The three flags `expressSweep`, `dashBlast`, `firePool` and `critCoin` stay on `WeaponStats` and are set by the combo `build` hooks, because the `Build` golden snapshots contain them. Nothing reads them at runtime any more (comments in `types.ts`). Delete them in phase 8 together with the golden regeneration.
- `weapons.ts` still has cosmetic `recipes.includes('toastMode' | 'nailstorm' | 'greaseFire' | 'brainFreeze')` reads (sprite tint, flame sparks, rotation speed, the toast sound rate). They touch no rule; phase 7 moves them into the patterns.
- Nailstorm's homing is still done in the projectile update of `weapons.ts` (reads `s.homing` and `contentComboTune('nailstorm')`): it is part of the shot's motion, which belongs to the phase 7 pattern.
- The Blast-set radius for Confetti is now read at set level L1 (`c.tuneOf('blast')`), exactly as before; the L3 multiplier is still ignored (documented in the phase 5 notes).
- Text quirks preserved byte for byte (golden `text.json`): the Sparks Fly DE detail says "TV-Dinner" while the DE combo name is "Fertiggericht"; the ordinal suffixes in the Chicken Dinner ("4th"), Frostbite Nails ("3rd") and Ray Gun ("3rd") text are literal, not computed from `every`; Express Checkout keeps the literal "1.0 s" (the `s` formatter would print "1 s"). Fix them together when the text is reworked.
- `WeaponStats` fields that no code reads any more after phases 4..6 (besides the flags above) are listed for phase 8 below.

**Tests.** `tests/content/combos/<id>.test.ts` for all 31 (recipe detection: triggers with exactly the parts touching, not without any one part, not on another weapon, not when a part does not touch the weapon, replaced / overridden combos; the registered content and the converted `RecipeDef`; EN/DE names; the build hook against the legacy formula; the runtime hook through FakeCtx with exact `combatRng` draw counts: Smash the Bank, Sparks Fly, Static Cling, Shrapnel, Clearance Sale; no extra draws where there are none), `helpers.ts` (`describeCombo`, `applyCombo`, `partsOf`, ...), and `order.test.ts` (mark / Five-Alarm / crit, slow vs Frost, Multipack, Pot Slam before Express Checkout, RECIPE_ORDER iteration). `tests/sims/sims.test.ts` checks that each of the 31 combo sims actually activates its combo (through `createSimRun` -> `computeBuild`).

**Sims.** `src/sims/combo-<id>.ts` (kebab-case of the combo id: `combo-bag-it`, `combo-five-alarm`, ...), one per combo, listed in `docs/sims.md`. Cart parts have explicit `at`, found by a search over the grid with the real build code; Bag It and Clearance Sale have mortal dummies (`immortal: false`), Smoothie Shield has spitters. Two sims activate a second combo by the nature of the parts: Sour Mist's spray + fan is also Mist Machine, and Tailwind's sim has an Energy Drink so Sugar Rush (cart combo) is active too.

**Notes for phase 7 (patterns).**

- The pattern code now only emits events; every combo branch is out of `Arsenal` (`rayShots`, `expressIcd`, `chickenSweeps`, `dashBlast`, the puddle `frozen`, the laser's power-surge scheduling and marking). What stays is the cosmetic `recipes.includes` reads and nailstorm homing (above). Moving them: give the pattern a param (`tint`, `spark`, `turn`) that the combo's build hook sets, or a `pattern:*` event.
- `Arsenal.weaponOf(uid)` + public `laser` / `explode` / `bolt` back the `ctx.sweep` / `explode` / `beam` forwarders; a pattern file should expose "run this weapon once at (x, y, angle)" as its own entry point instead of a public method on `Arsenal`.
- `pattern:fire` is only emitted by the Nail Gun burst. Toast, ricochet and the other projectile patterns have no equivalent, because no combo needs one; add it the same way (`handled` flag) when a combo wants to replace a shot.
- The 'hit' stage costs one emit per enemy hit; it is guarded by the empty-handler-list check like the others. Keep it that way when a pattern is rewritten.

**Notes for phase 8 (delete old).**

- `WeaponStats.critCoin`, `expressSweep`, `dashBlast`, `firePool` (set, never read; the golden `Build` JSON has them) and `homing` once the pattern reads a param instead; `Build.shoveStun` (phase 5). Regenerate the goldens only with the owner's approval and review the diff by field.
- The ui `row*` keys of the sets (phase 5 note) and any remaining `recipeT`-shaped fields on `RecipeDef` (`short`, `summary`, `detail` are rendered in English into `RECIPES` for the legacy readers).
- The `RecipeId` union in `types.ts` can be derived from `RECIPE_ORDER`; `RECIPES` goes when its last readers (`synergies.ts` matching, `recipeParts`, `recipeIcon`) read the content directly.
- `systems/combat.ts` still re-exports `tailwindFeedsSugar`; drop it when the old tests import it from `engine/stacks`.

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
