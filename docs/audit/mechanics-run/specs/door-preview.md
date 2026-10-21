# Unit door-preview: door cards show what is behind them

Background: `docs/audit/mechanics.md` proposal 9. HP is almost always full before an aisle, so the door choice (Rush, Quiet, Event and so on) is made blind and is mostly a coin choice.

## Rule

- Each door card on the route screen (`routeHtml`, `src/ui/ui.ts:455-507`, regular cards at `:487-498`) shows:
  1. The 3 most common enemy types for that aisle (icon and name, ordered by expected count), from the aisle's spawn plan.
  2. The elite situation: whether the modifier forces or raises elites, and the affix if one is forced.
  3. The hazard intensity of the department for that aisle, as a short label or 0 to 3 pips.
- The boss card and the Staff Only card keep their current content. Add enemy types to the boss card only if it is cheap and reads well.

## Implementation constraints

- `waveSpawnPlan(state)` (`src/systems/shop.ts:127`) reads state that `chooseDoor` (`src/state/run.ts:446-461`) and `startNextWave` (`run.ts:400`) set. Add a pure `previewAisle(state, doorId)` that computes the plan the aisle would have if that door were chosen, without mutating `state` and without drawing from `flow.rng` or any other stream. Prefer refactoring `waveSpawnPlan` to take its inputs explicitly so the preview and the real aisle share one code path.
- If any part of the plan is decided by a random draw at aisle start (for example the elite affix roll), show only what is known before the draw (for example "elites likely" or the forced affix), never a value that the real roll could contradict.

## Tests (behavior)

- For each door kind, `previewAisle(state, door)` equals the `waveSpawnPlan` computed after actually calling `chooseDoor(door)` and `startNextWave` on a copy of the state (same top enemy types, same counts).
- Calling `previewAisle` does not change `state` (deep equal before and after) and does not change what the run does next: with the same seed, the next shop's offers and the aisle's spawn plan are identical with and without preview calls.
- The route screen renders the enemy names for each regular door (DOM test, existing pattern).

Golden snapshots should not change.
