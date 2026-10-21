# Unit interest: base interest for everyone, shown before you leave the shop

Background: `docs/audit/mechanics.md` proposal 8 and "Saving, rerolling and selling are never worth it". Interest exists only at Checkout set level 2+, capped at 5, while inflation costs 10% per shop, so holding coins is never right.

## Rule

- Interest is paid in `finishWave` (`src/state/run.ts:389-393`), after the wave-clear bonus, as today.
- Every run earns interest: +1 coin per `ECONOMY.interestPer` (10) coins held, capped by the run's interest cap.
- The cap comes from one table indexed by Checkout set level: level 0 and 1 give `3`, level 2 gives `6`, level 3 gives `10`. Put the base values in `ECONOMY` (`src/data/waves.ts`) and the Checkout set's own values in its tune (`src/content/sets/checkout.ts:8`, today `interestCap: [5, 5, 8]`). One source of truth, no duplicated numbers. Remove the old `sets.checkout >= 2` gate.
- Inflation stays `0.1` per shop. A later balance unit may change it.
- Fix the stale comment in `src/content/sets/checkout.ts:5` that says interest is paid in `endAisle`.

## Display

- Add a pure helper `interestPreview(state)` that returns what the next `finishWave` would pay with the current money and build. The shop receipt column (`src/ui/shop.ts:303-316`, near the wallet at `:309`) shows "Interest next aisle: +N (max M)" from it, updating as the player spends. EN and DE.
- Update the Checkout set text so it describes the higher caps, EN and DE.

## Tests (behavior)

- With no Checkout items and 35 coins, finishing a wave pays +3 interest (logged with `coinInterest`). With 80 coins, it pays +3 (cap).
- With Checkout level 2 and 80 coins, it pays +6; at level 3 with 120 coins, +10.
- `interestPreview` matches what `finishWave` then pays.
- The receipt shows the preview line with the right number (follow the repo's existing DOM test pattern, for example `tests/affinity-ui.test.ts`).

Golden: text.json `sets.checkout.*` changes. Declare it.
