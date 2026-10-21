# Unit death-recap: the player sees what hurt them

Background: `docs/audit/mechanics.md` proposal 4 and "The player cannot tell what killed them". Runs die from near-full HP inside one aisle, and the end receipt shows damage dealt but nothing about damage taken.

## Data shape

- A typed damage source: `type HitSource = { by: string; how: HitHow; affix?: EliteAffix }` where `by` is an enemy id, hazard kind, event id or item id, and `HitHow` is a closed union such as `'contact' | 'charge' | 'swipe' | 'shot' | 'blast' | 'boss' | 'hazard' | 'event' | 'self'`. Put it in `src/types.ts` next to `RunStats`.
- `RunStats` gains `taken: Record<string, number>` (damage taken per source key, key = `how:by`) and `lastHit?: HitSource`. Initialise in `createRun` (`src/state/run.ts:62`).
- A pure `recordHit(stats, source, dmg)` in `src/systems/damageStats.ts`.

## Wiring

- `hurtPlayer(dmg, source)` (`src/scenes/ArenaScene.ts:962`) takes the source and calls `recordHit` only when damage actually lands (after the early returns and the `onPlayerHit` hooks, with the final amount).
- Every caller passes its source (10 call sites, listed in the context report): enemy shots (`src/scenes/weapons.ts:113`; enemy projectiles must carry the firing enemy's id and affix from fire time, `src/scenes/enemies.ts:382, 404, 502`), swipe (`ArenaScene.ts:990`), contact and charge (`:1242`), egg blast (`enemies.ts:389`), boss specials (`enemies.ts:493, 515`), Power Surge zaps (`src/scenes/events.ts:179`), oven vents and live cables (`src/scenes/hazards.ts:133, 143`), and `ctx.hurt` (`src/scenes/phaserCtx.ts:86`, `src/engine/ctx.ts:183`).
- Self-damage through `ctx.drain` (Ghost Pepper, Scratch Ticket) records `how: 'self'` with the item id.
- The build lab's mirror (`src/engine/fakeCtx.ts:300-301` and `hurt(...)` calls in `src/buildlab/combat.ts`) accepts a source too. It may pass a generic source; the lab does not need the recap.

## Display

- On the defeat receipt (`endHtml`, `src/ui/ui.ts:541`), above or beside the damage-dealt breakdown: "Wiped out by: <enemy or hazard name> (<how>)", with the elite affix name when there was one (for example "Baguette swipe (Elite, Swift)").
- Below it, the top 3 damage-taken sources with amounts. Show the top 3 on victory receipts too, without the "wiped out" line.
- Use existing name lookups (`enemyT`, hazard and event names, `itemT`). EN and DE for every new string, including the `how` labels.

## Pinned tests to update

`tests/content/items/bubblewrap.test.ts:78` slices ArenaScene source from `'hurtPlayer(dmg: number)'`. `tests/weaken.test.ts:132-145` asserts exact `this.hurtPlayer(...)` text. `tests/content/items/tinfoilhat.test.ts:130` asserts statement order around `sc.hurtPlayer(s.damage)` in `weapons.ts`. Update them to pin the same contracts against the new code.

## Tests (behavior)

- `recordHit` accumulates per source key and sets `lastHit`.
- The defeat receipt renders "Wiped out by" with the right name and affix and lists the top 3 sources in descending order (DOM test, existing pattern). The victory receipt lists the top 3 without the "wiped out" line.
- A receipt for a run with no recorded hits renders without errors.

Golden snapshots should not change.
