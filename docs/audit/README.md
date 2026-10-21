# Game audit, October 2026

Status: draft, 2026-10-20. Nothing in this folder is a decision. It is input for one.

Update, 2026-10-21: the mechanics proposals except proposal 10 are implemented, and the run is recorded in [mechanics-run/](mechanics-run/README.md). That run also fixed bugs 6, 13 and 29 from [bugs.md](bugs.md). The other bugs are still open as listed.

The audit has three parts:

- [bugs.md](bugs.md) lists every bug that survived verification, ranked by severity, with file, scenario and fix.
- [mechanics.md](mechanics.md) reviews the game design and ranks 12 proposals.
- [visual.md](visual.md) reviews the current look and recommends one of three overhaul directions, with a phased plan.

## How the audit ran

The baseline was green before any agent started. `npm run typecheck` was clean, and `vitest run` passed 184 test files and 2,245 tests. Every bug below is therefore one the test suite does not catch.

Seven Opus agents at high effort each read one area:

1. State, economy and shop rules.
2. Engine, combat systems and data tables.
3. Phaser scenes.
4. Item, combo, set and enemy content.
5. UI, flow, i18n, input, profile and Electron.
6. Mechanics and balance, with fresh runs of the build lab.
7. Visuals, with fresh captures from `npm run shot`.

A second pass of 32 agents then tried to refute every finding. Each critical and high bug got two independent refuters on different models, one tracing the code and one writing a repro test. Each medium bug got one refuter, and each report's low bugs got one batch refuter. A last agent searched the areas nobody had covered (audio, long sessions, save migration, build lab, release tooling) and found one more medium bug.

The refuters refuted none of the 20 claims at critical, high or medium, but lowered the severity of 10. Eight mediums became lows. One critical became high, and one high became medium. Two claims came back only partly confirmed. One had a wrong repro step, and the other described a coin-upgrade path that does not exist. The severities in [bugs.md](bugs.md) are the ones after verification.

## Labels

- **Confirmed by test.** A throwaway vitest repro drove the real code and showed the failure. The test was deleted afterwards.
- **Confirmed by trace.** At least one agent walked the full path in the code, and a refuter could not break it. The scenes cannot run under vitest (`tests/miniboss.test.ts:122`), so most scene bugs carry this label.
- **Confirmed by screenshot.** A fresh capture shows the failure. The captures are in `screenshots/audit-2026-10-20/` (gitignored).
- **Unverified.** A lead that nobody traced end to end. These are listed separately.

Numbers in [mechanics.md](mechanics.md) carry their own labels: structural, proxy, or judgment.

## Reproduce a capture

`tools/verify-shot.mjs` needs a longer boot delay when it runs JavaScript on a cold dev server. With the default `BOOT=1500`, the hook fails with `__arena is not defined`.

```bash
BOOT=7000 npm run shot -- wave3 out.png 3000 "__gg.flow.endWave()"
```
