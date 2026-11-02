# Unit disclosure: introduce systems one at a time

Background: `docs/audit/mechanics.md` proposal 11 and "Too many systems are visible at once". About 10 build layers are visible from the first shop. This unit runs after the feature units are merged, so the shop now also shows a featured-combos line, an interest preview, door previews and tier-based set points. Keep those visible.

## Rule

Disclosure is per profile, for new players. Once a system has been introduced, it stays visible forever. Store the flags with the existing tutorial flags (`settings.tutorialSeen`, `src/state/settings.ts:14-16`, written via `src/ui/tutorial.ts:42-46`), as one key per system. Add a Settings toggle "Show all systems" (EN/DE) that marks every system as introduced.

1. **Sets.** Hide the set panel in the shop receipt, the set chips on offer cards, inspector and level-up card, and set badges until the player first has 2 or more items of one set placed in the cart in any run. From then on, show them always. When it first happens, show a one-time short explainer near the set panel (reuse the tutorial bubble style).
2. **Active slots.** Obsolete: the active system (and its Q/E/F slot chips) was removed.
3. **Reactions.** The first time each reaction fires for this profile, show a short non-blocking banner in combat naming the reaction and what it does in one line (EN/DE). Never again for that reaction.
4. **What changed.** After every drop in the shop (place, move, rotate, merge, sell), show one line under the build stats summarising what the drop changed: weapon damage or cooldown deltas, combos formed or lost, set level changes. Compute it as the difference of two `computeBuild` results (before and after), not by re-deriving rules. Hide it after a few seconds or on the next drop.

## Constraints

- Tutorial anchors (`src/ui/tutorial.ts:21-27`) must still resolve when the tutorial runs. If an anchor is hidden by this unit at that moment, either show that element for the tutorial step or move the step.
- The Test Lab, sims and the build lab are unaffected (everything visible in the lab).
- `src/ui/shop.ts` `render()` is one template literal. Keep the change surgical.

## Tests (behavior)

- A fresh profile's first shop renders without the set panel and set chips; after a run in which 2 items of one set were placed, the next shop shows them; the "Show all systems" toggle shows them immediately.
- The reaction banner shows once per reaction per profile.
- After a drop that forms a combo, the change line names the combo; after a drop that changes nothing, no line.

Capture the first shop for a fresh profile and for a veteran profile with `BOOT=7000 npm run shot` in EN and DE, and list the shot paths in your report (save them under the scratchpad shots folder: /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/shots-after/).

Golden snapshots should not change.

## Also in this unit

- **★3 teaser.** ★1 and ★2 offer cards and the inspector never show what ★3 unlocks, so a player cannot see why merging is worth it. Show each weapon's ★3 line on ★1 and ★2 cards and in the inspector, dimmed, prefixed with "At ★3:" (EN) and "Bei ★3:" (DE). Reuse the ★3 text the weapon units added (`ItemText.star3` and `itemRules`). Add the text to the tutorial's set or merge explainer if there is one.
