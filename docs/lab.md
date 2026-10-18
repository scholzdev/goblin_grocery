# Test Lab

Dev and test builds only (`?lab=1` on the dev server, `npm run lab`, `--lab` in Electron; gate in `src/lab.ts`). Title menu, Test Lab, set the first values, Open the Lab.

## The loop

1. **Cart editor.** The bench takes the left column. Items tab: click an item to put a copy in the cart's first free spot (or on the shelf, see Add to), pick the tier first. Drag items in the cart as usual. Three loadout slots save and restore cart, shelf and their sizes (they survive reloads).
2. **Fight.** The big button (or F8) flips to the arena. In dummy mode (default) there are no waves: spawn dummies from the Dummies tab, drag them with the mouse, F8 goes back to the cart. Dummies picked in the cart editor spawn when the fight starts. In real-aisle mode the fight is the real aisle.
3. **Measure.** The Meter tab shows rolling DPS (last 5 s), average, peak, total damage and the damage per source. It starts at zero with every fight. It reads the run's own damage stats and clock, so pausing does not skew it.
4. **Tweak and repeat.** The Setup tab changes aisle, department, modifier, event, shift, character, god mode (and mode, cart size, shelf size, loyalty in the cart editor) at any time. In the arena a change restarts the fight with the same dummies. Reset all starts the setup again from scratch.

## Where things live

| What | Where |
| --- | --- |
| Setup fields as one table (title form and Setup tab, parsing, which field is editable where) | `src/ui/labFields.ts` |
| Setup to run state, cart and shelf resize, adding items | `labApply`, `labAddItem` in `src/state/run.ts` |
| Loadout slots | `src/state/lab.ts` (pure), storage in `src/lab.ts` |
| Damage meter | `src/systems/dpsMeter.ts` (pure) |
| The bench panel | `src/ui/labBench.ts`, styles `#labbench` in `src/ui/style.css` |
| Live setup and reset | `flow.labTune`, `flow.labReset` in `src/flow.ts` |

`tools/lab-layout-check.mjs` checks that the bench overlaps nothing at 1280x800 and 1672x941.
