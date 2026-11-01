# Shared brief: Goblin Grocery audit (read-only)

Repo: /Users/scholzf/dev/goblin_grocery (Phaser 3.90 + TypeScript + Vite roguelite; HTML/CSS HUD and shop over one shared run state).
Scratchpad: /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad

The operator asked for a whole-game audit: bugs, a mechanics review, and a draft visual overhaul. The output is a draft document, no code changes.

## Rules
- Read-only. Do not edit, create, or delete files under src/, docs/, tools/, public/, electron/, or any tracked file. No commits, no branches, no stash.
- Exception: a throwaway repro test may live at `tests/_audit/<your-area>-*.test.ts`. Delete it before you finish. Never run vitest with `-u`.
- A baseline typecheck and full test run is writing to `scratchpad/typecheck.log` and `scratchpad/test.log` (the last line is `exit N` when done). Read those. Do not run the full suite yourself. Single-file runs (`npx vitest run tests/foo.test.ts`) are fine.
- Never read `tests/golden/__snapshots__/*.json` or `docs/item-hooks-refactor.md` whole. Grep them.
- Large files: Grep first, then read line ranges.
- Do not use the Claude Browser / in-app browser. Screenshots only through `npm run shot -- <sim-id> <out.png>` (tools/verify-shot.mjs), and only the visual agent does that.
- `handoff.md` lists a batch marked "built but not tested" (set level 3, double pack, elite affixes, set events, run-end unlocks). PRs #11-#16 merged after it. `git log -p` on recent merges touching your area is the likeliest place for regressions.
- `docs/new-items-plan.md` is an untracked draft plan by the operator. Read it for context; don't duplicate it.
- Something suspicious outside your area gets one line under "Out of scope leads", not a chase.

## Bug format
For each bug:
- **Title**, severity (critical: crash / softlock / save corruption / run-breaking; high: wrong game rule a player will hit; medium: edge case or visible glitch; low: polish / dead code).
- `file:line` (repo-relative), with the relevant excerpt (a few lines).
- Failure scenario: concrete inputs or state, then the wrong outcome.
- Label: **confirmed** (you traced the full path in code or reproduced it with a test, say which) or **plausible** (inferred, not traced end to end).
- Suggested fix in one or two sentences.

Quality over quantity. A false positive costs the operator more than a missed nit. Do not report style preferences as bugs.

## Output
Write your full report to `scratchpad/<your-area>.md`. Return only a short summary to the parent: counts by severity, the top 5 findings in one line each with file:line, and the report path.
