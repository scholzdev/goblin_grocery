# aisle-pace todo (Hillclimb playbook)

- [x] 1. Ground the workload and architecture before choosing the metric. (context report + planWave/updateDirector read; metric = real bot: aisle 1 cleared 3/3, aisle 3 reached >=2/3; constraint: aisles 1-2 < 60 s, enemies/s <= ~+20% over master)
- [x] 2. Build the measurement harness, prove its sensitivity, then freeze it. (scratch botrun.mjs with absolute imports + game seconds; integration 3/3 die in aisle 1, master run pending)
- [x] 3. Open the decision log via show-me-your-work. (decision.tsv in this dir)
- [x] 4. Ground each hypothesis in the architecture model from step 1.
- [x] 5. Loop, one hypothesis per iteration. (subagent delegation: skip, the change is a one-line data edit; the cost is the bot wall time, run here)
- [x] 6. Push past the first plateau.
- [x] 7. Stop when the predicate is met.
- [x] 8. Run Opening a PR. skip: brief says never push, never open a PR.
- [x] task: build-lab stock batch vs tsv-50472ea-d1.json (+ baseline batch on unchanged HEAD for drift), starting pool, Evening
- [x] task: docs/balance-hillclimb.tsv rows, docs/buildlab.md known deviation + stale 38 s text, events.ts comment
- [x] gates: tsc, vitest; deslop; stop servers; remove master worktree
