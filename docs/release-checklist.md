# First test release checklist

State as of 2026-10-18. Typecheck, `vite build` and all 1993 tests pass.

## Done

- [x] Test Lab, sims and dev keys (F2–F7, unlock-all) gated to dev/test builds (`VITE_DEV_KEYS=1`). Confirmed in a `vite preview` build: `?lab=1` shows no Lab or unlock-all button.
- [x] Release build smoke run: title → pick run → aisle 1 → wipe-out receipt, no console errors.
- [x] `index.html` description and og meta.

## Decide

- [x] **Platform: desktop.** `npm run release` builds `release/Goblin Grocery-<version>-{mac-arm64,mac-x64,win-x64}.zip`. Mac builds are ad-hoc signed (no Apple certificate), so testers use "Open Anyway". Install steps are in `docs/TESTERS.md`.
- [ ] Fill in the feedback channel in `docs/TESTERS.md`, then upload the zips (Drive, Dropbox, itch.io restricted page, or a GitHub release).

## Should do before inviting testers

- [ ] Browser check of the features `handoff.md` lists as untested: set level 3 FX, Doppelpack, elite affixes, set events, stockroom / cold room / VIP rooms. Fastest via the dev server `?lab=1` or a sim (`npm run sim`).

## Balance (buildlab, 200 runs, greedy policy, all starters, seed 1)

The greedy bot is weak (1.5% win rate, deaths peak in aisle 4 with 83/200), so treat this as relative signal only.

- **`conduct` reaction count is 0.** This isn't a bug: conduct needs a wet enemy (Spray Bottle, Mop, or the wet-floor event) hit by an electric weapon within 3 s (`src/engine/reactions.ts:135`), and the greedy bot rarely pairs those. Buildlab doesn't simulate the wet-floor event, so it undercounts slightly. Wet sources may be too rare for conduct to matter in practice.
- **Laser:** picked in 6.5% of runs, in the final cart in 0%. The bot always sells it, so it's likely underpowered.
- Snack bag (1.5% final) and power strip (2% final) are also rarely kept.
- Night starter: 0% wins, avg aisle 4.38 (lowest). Coupon starter is best at 5.02.
- Fan (99.5%) and fuel (88%) show up in nearly every run, likely tied to the toast-mode combo (88%).

Rerun: `npm run buildlab -- --runs 50 --seed 1 --starter all` (output in `buildlab-out/run.json`).

## Later

- Web build (itch.io) and touch controls, if a browser playtest is wanted later.
- Apple Developer ID signing + notarization and Windows code signing, to drop the security warnings.
- Code-split the 1.6 MB chunk (it only matters for slow connections on web).
