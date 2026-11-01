# Implementer brief: Goblin Grocery mechanics

poteto-mode SKILL.md: /Users/scholzf/.claude/plugins/cache/pstack-claude/pstack/0.9.93/skills/poteto-mode/SKILL.md (read it in full before any work).

You implement one unit of a larger change. Other agents implement other units in parallel, each in its own git worktree. An integrator merges all branches later.

## Repo and worktree

- Main checkout: /Users/scholzf/dev/goblin_grocery. It stays on `master`. Never edit files there, never check out a branch there, never touch its untracked files (`CLAUDE.md`, `docs/new-items-plan.md`, `docs/audit/`, `.audit/`).
- Base branch: `mechanics/integration` (has its own worktree at `.claude/worktrees/integration`; never edit that worktree either).
- Create your own worktree and branch, then work only inside it:
  `git -C /Users/scholzf/dev/goblin_grocery worktree add .claude/worktrees/<unit-id> -b mech/<unit-id> mechanics/integration`
  If git reports a lock error, wait a few seconds and retry. If your prompt names an existing worktree (a fix round), do not create one. Work in that worktree on its branch and add new commits on top.
- `node_modules` resolves from the main checkout. `npx tsc --noEmit` and `npx vitest run` work inside the worktree.
- Background docs you may read (absolute paths, main checkout): `docs/audit/mechanics.md`, `docs/audit/bugs.md`, `docs/buildlab.md`, `docs/sims.md`, `README.md`.

## How to work

- Read the context report in your prompt first. A haiku agent gathered it so you need little exploration.
- Name the data shape before writing logic. Encode rules in tables, typed models or registries, not scattered conditionals.
- Write behavior tests: drive the code through what a player or caller observes (run state, offers, build stats, rendered text), derived from the spec, not from running the code. Each new test must fail on the base branch and pass on yours.
- Comments: only a non-obvious why. No narration comments in tests. The assertion message documents the step.
- Keep the diff small. Change only what the spec asks. No balance tuning beyond the numbers the spec gives.

## Hard rules

- **`flow.rng` stays untouched.** Shops, spawns, coins and events share it (`src/flow.ts:20,61`). Never add, remove or reorder draws from it in real runs, unless your spec says so. A new random need gets its own stream derived from the run seed, like `combatRng` in `src/systems/rng.ts:21-29`.
- **Lab, sims, build lab and bot set `state.unlocked` themselves** (`createLabRun`, `createSimRun`, `src/buildlab/run.ts:141`, `src/bot/bot.ts`). Do not change what they offer unless your spec says so.
- **i18n.** `src/i18n/ui.ts` has one `en` object and one `de` object typed against it. Every new key goes into both, placed right after a related existing key, never at the end of a section. Write real German. Item, enemy and combo text lives in `src/i18n/data.ts`, `src/i18n/data-de.ts` and the content files.
- **Pinned source-text tests.** Some tests assert exact code strings (for example `tests/content/items/bubblewrap.test.ts:78`, `tests/weaken.test.ts:132-145`, `tests/content/items/tinfoilhat.test.ts:130`, `tests/engine/registry.test.ts:204`, `tests/golden/carts.ts:105`). If your change breaks one, update it to pin the new contract. Do not delete the coverage.
- **Golden snapshots** (`tests/golden/__snapshots__/build.json`, `text.json`) are shared by every unit. If your change intentionally changes them, run `npx vitest run -u tests/golden`, inspect `git diff`, and commit the snapshot update as your LAST commit with subject `golden: regenerate for <unit-id>`. Report the changed top-level key prefixes (for example `items.toaster.en`, `sets.kitchen.*`, `buffs.*`, `weapon.*`). The integrator regenerates once after merging and checks that every changed key belongs to a prefix some unit declared. An undeclared change fails the gate.
- **Gates before you finish:** `npx tsc --noEmit` clean, and `npx vitest run` fully green in your worktree. Paste the final summary lines of both into your report.
- **Commits:** small and single-purpose, imperative subject, body only if needed, and end every message with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push. Never open a PR. Never amend or rebase the base branch.
- Before your final commit, run a deslop pass on your own diff (remove AI-style slop, needless comments, defensive code for impossible states).

## Report (your final message)

Return the structured report the caller asks for: branch, worktree path, commits (short sha and subject), the tsc and vitest summary lines, golden key prefixes changed (empty if none), files touched, any decision you made that the spec did not dictate (with why), and open issues. Keep it factual.

## Screenshots from a worktree

`tools/verify-shot.mjs` cannot start its own dev server inside a worktree (`tools/lib/dev.mjs` looks for vite under the worktree root). Start one yourself from your worktree with the main checkout's vite, on a free port, in the background: `node /Users/scholzf/dev/goblin_grocery/node_modules/vite/bin/vite.js --port <port> --strictPort`, then run `GG_URL=http://localhost:<port> BOOT=7000 npm run shot -- <sim-id> <out.png> [wait] [js]`. Stop the server when done. Never use the Claude in-app browser.
