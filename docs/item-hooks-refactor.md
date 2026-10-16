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

**Where each hook is emitted** (ArenaScene.ts / weapons.ts, current line numbers): `onAisleStart` ArenaScene:181 (combat phase only, after the banner) · `onTick` :989 (inside the combat-phase block, after regen) · `modifyDamage` :629 · `onCrit` :640 · `onHit` :661 · `onKill` :853 (end of `killEnemy`, after loot, Splitter/Melon spawns and the boss/mini-boss callbacks, credited kills only) · `onDashStart` :1077 · `onDashHit` :1103 (right after the shove damage) · `onDashEnd` :268 (`dashLanding`, first line) · `onPlayerHit` :942 (`hurtPlayer`, before `damagePlayer`; Bubble Wrap armor itself still lives in `run.damagePlayer`) · `onCoinPickup` :928 · `onEnemyShotTouch` weapons:666 (before the legacy Tin Foil reflect) · `pattern:sweep` weapons:474 (`before`) / :494 (`after`) · `explode` :394 · `zap` :282 / :292 · `bounce` :633 · `shotHit` :615 · `beam` :227 / :234 · `pulse` :538 · `cone` :337 · `puddleEnter` :444 · `aura` :252.

**FakeCtx** (`engine/fakeCtx.ts`): `new FakeCtx({ seed, aisle, build, hp, maxHp, ... })` with a manual clock (`advance(s)`, `tick(dt)` also emits `onTick`), the arena's rng (`combatRng(seed, aisle)`), an in-memory enemy list (`spawnEnemy`), hostile shots, and a `calls` log (`callsOf('stun')`, ...). `damage` records and then runs the same hook-visible pipeline as the scene (modifyDamage, crit roll, onCrit, hp, onHit, onKill); `hit(enemy, dmg, stats?, opts?)` runs it without recording (use it as "the weapon hit"). `ignite`/`slow`/`poison`/`mark`/`stun` record **and** apply to the in-memory enemy; `popperBlast` damages with `fromPopper`; `hurt` honors i-frames and `onPlayerHit`; `delay`/`tween` run when the clock reaches them. `attach(table)` wires compiled hooks in. Test pattern: `buildHooks(cart, build.recipes, build.sets, fake)`, `fake.attach(table)`, drive, assert. **Not simulated**: everything the scene still does outside hooks (the legacy Five-Alarm / mark multipliers, armor, status application from `stats.burn/slow`, knockback, echo, chain). An item's test only sees its effect once the legacy branch is gone.

**PhaserCtx** (`scenes/phaserCtx.ts`): a field-by-field forwarder to `damageEnemy`, `stunEnemy`, `popperBlast`, `hurtPlayer`, `dropCoin`, `arsenal.spawn/firePool/reflect/kill`, `fx`, `play`, `tweens`, `time`. The only logic is `damageArea` (a loop), `heal` (clamped add) and `ignite` (runs the burn through `aisleEvent.burn`, like the weapon branch). `Arsenal.spawn`/`firePool`/`reflect` and `ArenaScene.healHeartFx`/`wave` went from private to public for it.

**Seeded combat rng.** `combatRng(runSeed, aisle)` (`systems/rng.ts`) = mulberry32 of `(runSeed ^ salt) * golden + (aisle + 1) * c ^ salt`; the scene creates it as the first line of `create()` (`scene.rng`, `scene.rngBetween(min, max)`, `ctx.rng()`). It never touches `flow.rng`, and no `flow.rng` call site changed, so shop rolls, spawn plans, kill coins and bread keep their exact sequences. A daily run now rolls the same combat numbers on every play. The rng is per aisle (recreated each `create`), so restarting an aisle replays it.

- **Changed to `rng()`** (all gameplay-affecting): ArenaScene crit roll, Heat ignite chance, Frost stun chance, Electric chain chance, Kitchen heal, Blast pop, Coupon (`coinChance`), Tip Jar (`dashCoinChance`), `dropCoin` scatter (angle, speed, height), Splitter and Melon spawn angle, lab dummy position (`rngBetween`); weapons.ts nail spread, Sparks Fly stun, Shrapnel angle, Smash the Bank, Static Cling target shuffle; enemies.ts `pickAffix` (now takes the rng), first attack cooldown, Expired Milk blink timer and angle, boss slush / ring attack angles; hazards.ts timed-hazard jitter; events.ts Wet Floor patch positions, Power Surge zap position and side.
- **Left as `Math.random` / `Phaser.Math.Between`, on purpose** (cosmetic: no outcome depends on them): particles and flames (`fx.*`, `fx.ts`), sound pitch (`play(..., { rate })`), the sweep fx spin direction, sprite wobble (`animT`), the crit / echo / death fx jitter, the jagged shape of the electric arc, the heatwave puffs. `tests/engine/rng.test.ts` fails if a new `Math.random` line in the arena files doesn't look cosmetic (an `fx.`, `play(`, `animT` or `rotation:` on the same line).
- **Left on `flow.rng`, on purpose**: spawn plan, spawn timing and picks, elite rolls, kill-coin counts and chance, bread drops, mini-boss variant, boss summons, crates, event and modifier rolls, Wet Floor streak layout, stockroom layout. They already use a seeded stream; moving them would shift every later shop roll. Revisit at phase 8 if a fully separate stream is wanted. `flow.ts` seeding itself is unchanged (`Date.now() ^ Math.random()` for non-daily runs).

**Notes for phase 4** (one runtime item = move its legacy lines into `hooks`, delete the legacy branch, keep the rng draw order, add a FakeCtx test):

- Build-literal fields the hooks replace (`computeBuild`'s `Build` literal and `describeBuffs`) go in the same step, or the old field stays and the hook reads `ctx.build`. Prefer deleting the field.
- **Fuel / Ice** (burn / slow application): `stats.burn` / `stats.slow` are WeaponStats fields set by the *build* hook and applied in `damageEnemy` (lines right after `onHit`). Moving the application means an `onHit` hook: `ctx.ignite(hit.enemy, burn)` / `ctx.slow(hit.enemy, slow)`, reading the burn from `c.tune()` (tick, dps scaled by the weapon's `stats`) instead of `stats.burn`. But Jelly Beans, the Heat set (ignite), Grease Fire, Reheat and the puddles read `stats.burn` too, so move the *application* only after those readers stop needing it, or keep `stats.burn` as the data and make the hook a thin applier (recommended: hook `onHit` applies `hit.stats.burn`; no data move). `ignite`'s `aisleEvent.burn` modifier is inside `ctx.ignite`.
- **Popper** (`onKill`): `if (hit.stats?.popper && !hit.opts.fromPopper) ctx.popperBlast(enemy, stats.popper)`. Order is already legal: `onKill` runs before the legacy kitchen / blast lines, but legacy ran popper *last*; the draw order is unchanged (popper uses no rng), the visual order is not important. Blast set L2 (phase 5) stays legacy until then.
- **Double Bag** (`onHit`): `hit.stats.echo > 0 && hit.direct` then `ctx.delay(ECHO_DELAY, () => ctx.combatActive() && enemy.alive && ctx.damage(enemy, hit.base * stats.echo, stats, { echo: true, quiet: hit.opts.quiet }))`. Use `hit.base` (the incoming damage), as the legacy line does with `baseDmg`.
- **Multipack** repeat is in `weapons.ts` (`MULTIPACK_REPEAT_DELAY`), not in `damageEnemy`: it is a pattern-side repeat, not one of these hooks. Leave it until phase 7 unless it needs `onAisleStart`/`onTick` state.
- **Boot** (`dashHit` extra damage via `build.shoveDamage`) / **Tip Jar** (coin chance, `ctx.rng()`) / **Sale Flag** (`ctx.mark(enemy, c.tune().duration)`) / **Tools-set stun** / **Express Checkout**: all `onDashHit` (Express Checkout: `onDashEnd` with `ev.hit`, it calls `arsenal.expressCheckout`; add a ctx method or keep the call in the scene). Boot's damage is added to the dash hit itself: `build.shoveDamage` is read when the scene calls `damageEnemy`, so either keep it a build field or give the dash hit a `modifyDamage` (`hit.opts.label === 'shove'`).
- **Slam Bumper / Pot Slam** (`onDashEnd`): `ev.x/ev.y`; Bumper's shockwave is `ctx.damageArea({x,y}, r, dmg, null, { kb: 200, label: 'Slam Bumper' })` plus `ctx.fx.ring`; Pot Slam is `arsenal.dashBlast` (needs a ctx method, or a `pattern:explode` source).
- **Spare Wheel** (`onDashStart`): the free-chain window is decided by the scene *before* the emit (`p.chainT`, `ev.chained`); the hook can only observe it today. To move it, let the hook set `player.chainT` / `player.shoveCd` (both on `PlayerView`, writable) and move the `shoveCd`/`chainT` assignment after the emit.
- **Flag** (Price Check / Sale Flag mark): application is `onDashHit` (`ctx.mark`); the ×1.2 multiplier is the `modifyDamage` slot (see the pipeline order). Price Check is a combo (phase 6): move the multiplier together with Five-Alarm then.
- **Coupon** (`onKill`): `hit` is credited; `ctx.rng() < c.tune().chance` then `ctx.dropCoin(enemy, label)`. Replaces the `coinChance` Build field. Legacy order: after bread, before Pickpocket loot (the `onKill` emit now comes after the loot; coin order differs, the count does not).
- **Bubble Wrap** (`onPlayerHit`): `ev.dmg = Math.max(1, ev.dmg - c.tier)` (armor = tier, see §7b phase 1) and i-frames via `ev.invuln`. Delete `run.damagePlayer`'s `armor` read; keep the final hp clamp there.
- **Free Sample** (`onCrit`): the heal is capped per whole second (`critHealSec` / `critHealed` scene fields): move that counter into `c.state`; `ctx.heal` + `ctx.fx.spark`. Clearance Sale's `critCoin` coin is the same slot.
- **Expired Milk**: the toxic aura is `cartCombos.update` (reads `build.stinkDps`): `onTick` with `ctx.inRadius(player, r)` and `ctx.poison(e, dps, dur)`; the ×0.9 max HP stays a build hook.
- **Tin Foil Hat** (`onEnemyShotTouch`): `if (p.reflectT > 0) { ctx.reflectShot(ev.shot, c.tune().mult); ev.handled = true }`; `reflectT` is set by the dash code (`TINFOIL.grace`), so also make the dash code's `reflectT` an `onDashStart` + `onTick` hook, or keep that line legacy.
- **Vacuum pickup**: `vacuumPickup` is a pickup-radius *build* field (`computeBuild` literal), not a combat hook; it moves with the weapon (phase 7) as a `player` hook.
- `Blast L2` / `Kitchen L2` / `Heat L2` / `Frost L2` / `Electric` rolls in `damageEnemy` already draw from `rng()`; when they move (phase 5) keep the draw order: crit, ignite, frost stun, electric chain, kitchen heal, blast pop.
- **Every hook that rolls must call `ctx.rng()`** (never `Math.random`); FakeCtx tests seed it, so assert on exact outcomes with a fixed seed or on `rng` call counts.
- **Gotchas found while building this**: (1) the same `HitEvent` object travels through `modifyDamage`, `onCrit`, `onHit` and `onKill`; its `dmg` is the *current* damage at each stage. (2) Echo and chained hits re-enter `damageEnemy`, so every hit hook runs again for them (`hit.direct` / `hit.opts.echo` / `hit.opts.chained` tell them apart). (3) `onKill` is not emitted for uncredited kills (end-of-aisle cleanup, escapes, Egg Carton blast). (4) A damaging hook must pass `fromPopper` / `chained` / `echo` in `opts` to avoid re-triggering itself.

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
