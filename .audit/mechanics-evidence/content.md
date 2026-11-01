# Content audit (items, combos, sets, enemies)

Scope: all 65 items, 38 combos, 9 sets and 21 enemies in `src/content/`, plus the `define.ts` / `registry.ts` / `hooks.ts` contract they register through. I read every file by hand and checked cross-content invariants with two throwaway levers. Both are deleted again.

- **`scratchpad/content-scan.mjs`** (static; it is still in the scratchpad and can be rerun). For each file it lists the tune keys the code never reads, whether each one is shown in text, and any top-level mutable state.
  - All of its "unread key" hits turned out to be false positives: destructuring (`const { brownCut } = c.tune()`), generic `w.tune.*` / `contentTune` readers in the engine, or text-only mirrors that tests pin.
  - The one top-level state, Kettle Corn's `WeakSet` of kernel stats, is a membership tag and is fine.
- **`tests/_audit/content-invariants.test.ts`** (runtime, deleted). It loaded the real registry and checked:
  - Items: tier triples are monotone and not flat, every icon is in `ICON_IDS` and has an SVG, and a weapon's `tune` mirrors its `weapon` stats.
  - Combos: `requires[0]` is a weapon, there are no duplicate or identical part sets, and no combo needs a `noShop` item.
  - Enemies and bosses: every frame is in `SVG_ASSETS` with a file, every boss shot texture exists, every `SVG_ASSETS` key has a file, and every texture literal in content has an SVG.

  All of these passed. It also raised these false positives:
  - The 10 missing `enemy_*_tell` frames: non-boss tells go through `TELL_TEX` (`src/scenes/enemies.ts:90`), and every key there has an SVG.
  - Sour Mist being a superset of Mist Machine: this is intended (`tests/batch1.test.ts:40`).
- **Repros** (`tests/_audit/content-repro*.test.ts`, run with single-file vitest, then deleted) confirmed findings 1, 2 and 5 below.

Severity counts: critical 0, high 0, medium 3, low 7.

---

## 1. Adjacency hooks use the tier of the best copy anywhere in the cart, so Gold Star does not reach the Scoby (medium, confirmed by repro)

**Root cause.** A runtime item hook gets one `HookCtx` per item type. Its `tier` / `tune()` belong to the best effective copy anywhere in the cart.

`src/engine/hooks.ts:314`
```ts
for (const p of placed) top.set(p.type, Math.max(top.get(p.type) ?? 0, (p.tier ?? 1) + boost(p)));
```
`src/engine/hooks.ts:323`
```ts
sources.push({ id: c.id, kind: 'item', tier, tune: c.tune, hooks: c.hooks, weapons, instances, touching });
```
`HookCtx.touching(uid)` returns bare `ItemInstance`s with no effective tier. `BuildCtx.touching` does return `{ instance, tier }`.

Two symptoms follow, in opposite directions.

**(a) A low-tier module next to the weapon acts at the tier of a higher copy that touches nothing.** This affects Decaf (`src/content/items/decaf.ts:20`), Can Opener (`canopener.ts:20`), Sparklers (`sparklers.ts:18`, `every`) and Moldy Bread (`moldybread.ts:17`, spore `dps`). Each of them says "adjacent weapon" in its text.

```ts
// decaf.ts:17-21
onHit(hit, ctx, c) {
  const { stats } = hit;
  if (!stats || !hit.direct || hit.opts.quiet || !c.touches(stats.uid)) return;
  const t = c.tune();   // best copy in the cart, not the one touching this weapon
  ctx.weaken(hit.enemy, t.pct, t.duration);
```

- **Scenario:** a Toaster touches a ★1 Decaf, and a ★3 Decaf sits elsewhere in the cart.
  - Expected: the weaken is 15%. Actual: 25%.
  - The same cart shape with Can Opener (★1 touching, ★3 away) shreds on 20 of 20 hits, where ★1's 50% chance is expected.
- **Repro:** `arena([at('toaster'), at('decaf', 1), far('decaf', 3)])`. One hit logs `weaken` with `pct: 0.25`. With `far` removed it logs `0.15`.
- **The authors already treat this as wrong.** Multipack's post-combo hook avoids it explicitly (`multipack.ts`: "the count is decided by the best copy *touching* this weapon").

**(b) Kombucha Scoby ignores Gold Star.** Scoby works around the missing tier with the raw instance tier:

```ts
// src/content/items/scoby.ts:21
for (const p of c.touching(stats.uid)) dps = Math.max(dps, c.tuneOf(Item.scoby, p.tier ?? 1).dps * (1 + t.growth * (p.age ?? 0)));
```

- **Scenario:** a Pan touches a ★1 Scoby, and a Gold Star touches the Scoby. `tierBoostOf` reports +1.
  - Gold Star's text says "modules and passives touching it work one tier higher", so expected is ★2 = 3 dps. Actual: 2 dps.
- **Repro:** `arena([at('pan'), at('scoby'), gilded(1)])` logs `poison` with `dps: 2`. A plain ★2 Scoby logs 3.

**Fix.** Make `HookCtx.touching` return `{ instance, tier }` with the effective tier, as `BuildCtx` does. Then have Decaf, Can Opener, Sparklers, Moldy Bread and Scoby resolve their numbers at the highest touching tier, the way Multipack does.

---

## 2. Active-item tooltips still say "E" after PR #13 moved actives to Q/E/F slots (medium, confirmed by trace)

These strings are unchanged since the item commit a5f7c67:
- `src/content/items/airhorn.ts:8-9`: `rules: 'Active (E, {charges} per aisle): stuns every enemy on screen ...'`
- `src/content/items/bubblewrap.ts:8-9`
- `src/content/items/vacuum.ts:15-16`
- `src/content/items/fireextinguisher.ts:9-10`

The keymap now gives each slot its own key:
```ts
// src/state/keymap.ts:20-22
useActive1: ['KeyQ', ''],
useActive2: ['KeyE', ''],
useActive3: ['KeyF', ''],
```
Slots fill in cart reading order (`src/engine/actives.ts` `activeSlots`), and `fireActive(cart, ctx, slot)` fires only that slot. The contract doc in `src/engine/define.ts:241` is stale too: it still says "the E key spends one charge of every instance in the cart".

- **Scenario:** the cart holds a single active item (e.g. Air Horn), which takes slot 1 (Q).
  - The player presses E as the tooltip says. Slot 2 is empty, so `fireActive` returns false and nothing happens.
  - Keys can also be rebound, so a hard-coded letter in item text is wrong in any case.

**Fix.** Drop the key from the rules text (e.g. "Active ({charges} per aisle): ...") and let the HUD and shop slot chips show the bound key. Also update the `ActiveSpec` doc comment.

---

## 3. Items that do not scale with ★ are still offered at ★2/★3 and can be upgraded for coins (medium, confirmed by trace)

Collector's Binder (`src/content/items/binder.ts:9`, `tune: { perSell: 0.02, cap: 0.2 }`) and Shortcut Key (`src/content/items/shortcut.ts:8`, `tune: { mini: 4, boss: 8 }`) have no per-tier value. Their effect is the same at every ★.

Shop and upgrade code still treat them as tiered:
```ts
// src/systems/shop.ts:72  (any non-legendary, non-noShop item)
add(pool.splice(i, 1)[0], rng() < lv.tier3 ? 3 : rng() < lv.tier2 ? 2 : 1);
// src/state/run.ts:197-200
export function upgradeCost(i: ItemInstance): number | null {
  const t = i.tier ?? 1;
  return ITEMS[i.type].legendary || t >= TIER.max ? null : TIER.upgradeCost(ITEMS[i.type].price, t);
```
`mergeTargetFor` / `applyMerge` also merge them.

**Scenario.** At shop level 3 or higher, `tier3` is 4-10%, so a ★3 Shortcut Key can show up at 12 × 4 = 48 coins and a ★3 Binder at 56. Either buys exactly the ★1 effect. Upgrading a ★1 Binder costs 14 coins and changes nothing. The only return is the higher sell value, sold at the 50% rate.

**Prior coverage.** `tests/rules.test.ts:1148` already knows Shortcut and Spent Key have "no ★ scaling" (it expects no rows), but nothing stops the shop or the upgrade button. The Binder shows a "2% / 2% / 2%" row.

**Fix.** Add a `tierless` (or `maxTier: 1`) flag to `ItemContent` and honor it wherever `legendary` blocks tiers: `rollOffers`, `upgradeCost`, `applyMerge`, `mergeTargetFor`. Alternatively, give these items a real per-tier value.

---

## 4. Pressure Washer silently cancels Mist Machine's 120° cone when both are active (low, confirmed; behavior pinned by test)

```ts
// src/content/combos/mistMachine.ts:26
w.arcDeg += t.arcDeg - c.def(w.type).weapon!.arcDeg; w.range *= t.rangeMult;
// src/content/combos/pressureWasher.ts:25  (later in RECIPE_ORDER)
w.arcDeg = t.arcDeg + c.tapeArc; w.range *= t.rangeMult; w.damage *= t.damageMult;
```

- **Scenario:** a Spray Bottle touches a Desk Fan and a Battery.
- **Outcome:** both combos are listed as active, and Mist Machine's card says "Huge 120° spray cone". The weapon actually gets a 25° jet with range ×1.4 × 2. The Fan's bonus is still suppressed by Mist Machine.
- `tests/rules.test.ts:1131-1133` pins `arcDeg === 25` for this cart, so the outcome is deliberate, but neither combo text says so.

**Fix.** Add `replaces: [Combo.mistMachine]` to Pressure Washer so only one shows, or say in both texts that the jet wins.

---

## 5. Sparklers (and two combos) use the Blast set's L1 radius at L2/L3 (low, confirmed by repro)

```ts
// src/content/items/sparklers.ts:24
ctx.popperBlast(hit.enemy, { damage: t.damage, radius: t.radius * (ctx.build.sets.blast ? c.tuneOf(Set.blast).radiusMult : 1) });
```
`HookCtx.tuneOf(id, level = 1)` defaults to level 1. The Blast set has `radiusMult: [1.15, 1.15, 1.25]` (`src/content/sets/blast.ts:7`), and its L3 line reads "Blast radius +25%". The Popper module and zap/mortar AoE do get the correct level from the set's build hook. Sparklers, Confetti Cannon (`confettiCannon.ts:24`) and Fireworks Show (`fireworksShow.ts:24`) do not.

- **Repro:** Toaster + Sparklers + Popper + Multipack + Double Bag + Bumper (Blast L3). The sixth hit's `popperBlast` has radius 57.5, but the L3 text implies 62.5.
- Confetti Cannon and Fireworks Show document the L1-only radius as intentional legacy behavior. Sparklers copied the pattern without that comment. So this is an inconsistency with the set text rather than a broken new rule.

**Fix.** Use `c.tuneOf(Set.blast, ctx.build.sets.blast)` in all three, or have the L3 set text exclude these blasts.

---

## 6. Ray Gun's tooltip understates the red bolt's splash (low, confirmed)

```ts
// src/content/combos/rayGun.ts:11, :16
tune: { splashR: 60, splashMult: 0.6, every: 3, bigR: 120, bigMult: 1.2 },
detail: '... splash {splashMult|pct} damage ... Every {every}rd shot is a red overcharged bolt: splash radius {bigR} and +{bigMult|pctup}% splash damage.'
```
- **Rendered vs actual:** the text renders "+20% splash damage". The code splashes `shot.damage * sp.m`, which is 120% of the hit for the red bolt against 60% for a normal bolt, i.e. twice as much.
- The file comment admits the text was "kept as it was". The brief counts a tooltip/code mismatch as a bug. DE (line 21) has the same problem.

**Fix.** Write "splash radius {bigR} and {bigMult|pct} splash damage".

---

## 7. Sparklers ★3 English text reads "Every 3th direct hit" (low, confirmed)

`src/content/items/sparklers.ts:10`: `rules: 'Every {every}th direct hit ...'` with `every: [6, 4, 3]`. The ★3 card and the shop row render "3th". DE (`Jeder {every}.`) is fine. Frostbite Nails, Crack Open, Ray Gun and Thunderstorm hard-code "rd", which is right only while `every` stays 3.

**Fix.** Phrase it without an ordinal ("Every {every} direct hits ...") or add an ordinal formatter.

---

## 8. Electric set text says "Electric hits", but the bonus follows the `electrical` flag (low, confirmed by trace)

`src/content/sets/electric.ts` text: `'Electric hits: {chance|pctn}% chance to arc ...'`.

- **Code:** the build hook sets `chainChance` on every `electrical` weapon except zap: Toaster, Nail Gun, Vacuum, Blender, Laser. The `afterHit` hook then skips aura and puddle hits.
- **Mismatch:**
  - Toaster and Nail Gun hits arc, though `hitTags.ts` says they are not electric hits.
  - The Blender's aura ticks, which are one of only two sources of the `electric` hit tag, never arc.
  - The shop's "Strong vs" chip uses the narrow `electric` tag, so the two meanings sit side by side in the UI.

**Fix.** Reword the set line to "Electrical weapons: ..." and say auras do not arc, or gate on the hit tag.

---

## 9. German text errors on two enemies (low, confirmed)

- `src/content/enemies/honey.ts:16`: "Klebrig; zuerst platzieren." "Platzieren" means "place/position", while the EN text is "pop it first". Suggest "Klebrig; zuerst zerschlagen."
- `src/content/enemies/egg.ts:15`: "Platz ihn zuerst." is ungrammatical ("Platz" is the noun). Suggest "Bring ihn zuerst zum Platzen."

---

## 10. An enemy and an item share the name "Expired Milk" / "Abgelaufene Milch" (low, confirmed)

`src/content/enemies/expired.ts:15-16` (the teleporter) and `src/content/items/expiredmilk.ts:10-11` (the cursed passive) use the same display name in both languages. Codex entries, damage sources and death recaps become ambiguous, next to a third milk, the "Sour Milk" enemy.

**Fix.** Rename the teleporter (e.g. "Spoiled Carton" / "Verdorbene Packung").

---

## Mechanics notes (not bugs)

- **Possible stall-farm.** The Self-Checkout Kiosk boss summons Gift Cards (`boss_checkout.ts`, `summonTypes: [gum, giftcard]`, 4 per summon). A caught Gift Card always pays `coins × coinMult = 16`, so stalling that boss can farm coins up to its enrage. Worth checking against the boss shift timer.
- **Duct Tape on Popcorn.** Popcorn is not in `PROJECTILE_PATTERNS` or Tape's area list, so it falls to Tape's `else` branch and gains +range (`tape.ts` `w.range *= 1 + t.radius`). The Tape text promises projectiles pierce, areas radius and beams length, none of which is range for a kernel volley.
- **Sparklers gap.** When the `gap` blocks a due Sparklers blast, the hit counter still resets (`sparklers.ts:19-22`). Fast multi-hit weapons (Popcorn's 6 kernels) lose roughly half their blasts. This is consistent with "at most one blast every {gap}", but players may read the text as the blast being delayed rather than lost.
- **Dead tune entries.** Ghost Pepper `floor` and Scratch Ticket `floor` are display-only: `ctx.drain` hard-codes the 1 HP floor (`src/scenes/phaserCtx.ts:92-96`). They are consistent today and would drift silently if someone tuned `floor`.

## Out of scope leads

- `src/content/sets/kitchen.ts:32` says popper blasts "carry the weapon's stats", but `ArenaScene.popperBlast` damages with `stats = null` (`src/scenes/ArenaScene.ts:792`). As a result, popper/sparkler/confetti kills never count as weapon kills for the Kitchen heal, Basil, Bag It or Coupon's credited-kill logic. Check which behavior is intended.
