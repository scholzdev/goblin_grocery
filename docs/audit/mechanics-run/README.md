# Mechanics run, October 2026

This folder records how the proposals in [../mechanics.md](../mechanics.md) were built. Proposal 10 (directional modules) was skipped. Every other proposal is on this branch.

- `decisions.tsv` is the decision trail, one row per decision with its reason, evidence and result. Read it with `column -s$'\t' -t decisions.tsv`. Evidence pointers into `scratchpad/` or `.audit/` refer to files kept outside the repo.
- `specs/` holds the spec each implementer agent received.
- `baseline-metrics.md` is the build-lab baseline before any feature: master plus the build-lab fixes, 600 runs per pool, seed 1.
- `golden-gate.mjs` checks that every changed golden snapshot value falls under a prefix that a unit declared: `node golden-gate.mjs <beforeDir> <afterDir> <results.json>`.
- `todo.md` is the run's checklist.

Balance numbers here and in `docs/balance-hillclimb.tsv` come from the build-lab proxy and the kiting bot in `tools/botrun.mjs`. A human playtest still needs to calibrate them. The open questions are the opening-aisle pace (44 s with 25 and 27 groceries, or 38 s with 21 and 23), the Late shift at 4.2% win rate, and the daily stock showing items the player has not unlocked.
