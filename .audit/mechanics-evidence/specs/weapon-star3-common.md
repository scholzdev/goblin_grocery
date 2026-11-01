# Shared rules for the two weapon ★3 units

Background: `docs/audit/mechanics.md` proposal 6 and "Tiers barely pay off". Tiers scale damage and cooldown linearly, a policy that built 497 ★3 items did not win more, and the hillclimb's two tier buffs moved nothing.

## Rule

- Each tiered weapon gains exactly one new behavior at tier 3, gated `tier >= 3` so Gold Star ★4 keeps it. Laser is legendary with scalar tunes and is out of scope.
- The behavior changes how the weapon plays, not just a number. It must read in one short line on the ★3 card.
- It must not copy what an existing combo already gives that weapon (check `src/content/combos/*` for combos that include it). It must not stack a hidden damage multiplier on top of the tier multipliers. Aim for a modest gain in effective value; a later balance unit measures it.
- Put the behavior's numbers in the weapon's tune (one source of truth), not as literals in pattern code.
- Use the existing pattern code paths. You own only the pattern files listed in your unit. If you must touch a shared file (for example `src/engine/patterns/types.ts` or `src/engine/define.ts`), make the change additive (a new optional field) so the other weapon unit can merge cleanly, and say so in your report.

## Text

- Add the behavior to the weapon's `rules` text so `rulesByTier` at tier 3 shows it (EN in the content file, DE in its DE text). Tiers 1 and 2 text stays as it is.

## Tests (behavior)

- For each weapon: at ★2 the behavior does not happen, at ★3 it does, and at ★4 (Gold Star) it still does. Drive it through the same harness the weapon's existing tests use (FakeCtx, pattern tests in `tests/engine/patterns.test.ts`, or the build lab's `playAisle`).

Golden: build.json `weapon.<id>` tier-3 entries and text.json `items.<id>.*` change. Declare the exact prefixes.
