# Mechanics run evidence

Copied from the session scratchpad on 2026-10-21 so the pointers in `../mechanics.tsv` survive. A trail row that names `scratchpad/<path>` now lives at `.audit/mechanics-evidence/<path>`.

- `w2-results.json`, `w3-results.json`: unit reports (feature units, then disclosure and balance), with each reviewer's verdict.
- `integration-result.json`, `finish-result.json`, `fixround-journal.json`: integration, cleanup, fix round and real-game verification reports.
- `verdicts.json`: the audit's refute pass. The seven audit reports are the `*.md` files next to it.
- `specs/`, `impl-brief.md`, `brief.md`: what each agent was asked to do.
- `golden-gate.mjs`: the golden snapshot gate (`node golden-gate.mjs <beforeDir> <afterDir> <results.json>`).
- `baseline/`: build-lab baseline on master plus the scaffold (600 runs per pool, seed 1).
- `balance/`, `aisle-pace/`: decision logs, scripts and small reports. Raw build-lab outputs over 5 MB were left out; `balance-omitted.txt` and `aisle-pace-omitted.txt` list them. Regenerate any of them from the named commit with `npm run buildlab -- --runs 50 --seed <seed> --starter all --weapon all --pool stock --quiet --out <file>` (add `--shift 1` or `--shift 2` for Evening and Late), then `node tools/mechanics-metrics.mjs <a.json> <b.json>`.
