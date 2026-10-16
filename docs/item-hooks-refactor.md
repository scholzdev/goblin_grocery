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
