# Sims

A sim is a Test Lab scenario in one file. It drops you straight into the arena (or the cart editor) with an exact cart, department, event and enemies, so you can playtest items, sets and enemies without clicking through the Test Lab form. Fixed seed, so every start is the same.

## Run one

- `npm run sim` opens the dev server at `/?sim=example`.
- Any sim: `http://localhost:5173/?sim=<id>` (for example `?sim=electric-l3`). `?sim` turns the lab features on (dummy panel, F8, god mode), no need for `?lab`.
- From the game: title screen, Test Lab (needs `?lab` or `?sim`), the "Sim" select at the top, "Start sim".
- An unknown id shows a card listing the valid ids. A sim that does not validate shows its problems.

Keys:

| Key | What |
| --- | --- |
| F9 | Restart the sim from scratch (same seed). Works any time, also from the pause menu or the end screen. |
| F8 | Dummy sandbox only (`waves: false`): flip between the cart editor and the arena. Dummies come back. |

The HUD shows `SIM <id> · F9 = restart` (bottom left) and the sim's `notes` for 12 seconds (top right, click to dismiss). "Back to Lab" in the pause and end screens restarts the sim.

Notes: Jelly Beans re-roll their flavor each time the cart editor opens (a game rule), so a sim's `flavor` is the starting flavor. Sims use the shared run rng and the combat rng, nothing else, so a fixed seed repeats.

## Fields

Only `id` and `cart` are required. `src/sims/example.ts` uses every field with comments.

| Field | Default | Meaning |
| --- | --- | --- |
| `id` | required | Must equal the file name (lowercase, digits, dashes). |
| `notes` | none | Free text shown when the sim starts. |
| `character` | `'toaster'` | `toaster`, `pan`, `coupon`, `night` (perks only). |
| `aisle` | `1` | 1..15. 8 is the boss aisle, above is overtime. |
| `department` | `'main'` | `main`, `frozen`, `bakery`, `electronics`, `checkout`. |
| `doorMod` | `'none'` | Aisle modifier (`rush`, `clearance`, `event`, `quiet`, `stockroom`, `coldRoom`, `vipAisle`). Not the same as an enemy affix. |
| `event` | `'none'` | `'none'`, `'random'` (normal roll) or `wetFloor`, `outage`, `happyHour`, `heatwave`, `powerSurge`, `flashSale`, `freezerFail`. |
| `shift` | `0` | Shift index (0 = Day Shift). |
| `waves` | `false` | `false`: dummy sandbox, no waves, `enemies` are the dummies. `true`: a real aisle run starting at `aisle` (waves, director, boss at 8). |
| `start` | `'arena'` | `'arena'` starts the fight, `'shop'` opens the cart editor first. |
| `god` | `true` | No damage taken. |
| `money` | `999` | Coins. |
| `seed` | `1` | Run seed (shop offers, rolls, spawn spots). |
| `cartSize` | `[7, 5]` | `[cols, rows]`. |
| `shopLevel` | `1` | Loyalty level 1..3. |
| `cart` | required | Exactly the items in the cart. The starter weapon is not added. |
| `shelf` | none | `{ id, tier? }` items on the shelf (they do not count for the build). |
| `enemies` | none | Dummies, only with `waves: false`. |

Cart entry: `{ id, tier?, at?, rot?, flavor? }`.

- `tier` 1..3 (legendaries are always 1).
- `at: [x, y]` is the top-left cell of the item's footprint (after rotation). Entries with `at` are placed first and checked: out of bounds or overlapping is an error.
- Without `at` the item goes to the first free spot, scanning rows, columns and all four rotations.
- `rot` is clockwise quarter turns (0..3).
- `flavor` (`heat`, `frost`, `blast`) is for Jelly Beans.
- Modules (fan, fuel, battery, ice, hotsauce, pricegun, tape, popper, jellybeans, powerstrip, goldstar, doublebag, multipack) only buff ADJACENT weapons: give them an explicit `at` next to the weapon and check the footprints in `src/content/items`.

Enemy entry: `{ id, count?, affix?, still?, immortal?, mini?, at?, spread? }`.

- `count` copies (default 1).
- `affix`: `swift`, `tough`, `splitter`, `pickpocket`, or `'elite'` for a random one. Bosses, slices, eggs and gift cards cannot be elites, melons, slices and honey jars cannot split.
- `still` (default `false`): no walking or attacks. `immortal` (default `true`): refills HP instead of dying (so a Splitter never splits; set `immortal: false` to see it).
- `mini`: mid-shift boss variant index.
- `at: [x, y]` in arena pixels (x 78..1202, y 196..758): the spot of one enemy or the centre of the group.
- `spread` for a group: `'random'` (default, random spots away from you, or within a small jitter of `at`), `'cluster'` (one tight bunch, centre `at` or a random far spot), `'ring'` (around `at`, default around you).

## Add a sim

1. Create `src/sims/<id>.ts` (copy `example.ts`):

   ```ts
   import { defineSim } from './_sim';

   export default defineSim({
     id: 'my-sim', // same as the file name
     cart: [
       { id: 'toaster', at: [0, 0] },
       { id: 'fan', at: [2, 0] },
     ],
     enemies: [{ id: 'milk', count: 6, spread: 'cluster' }],
   });
   ```

2. That is the whole registration: `import.meta.glob` collects every `src/sims/*.ts` that does not start with `_`. Reload and run `?sim=my-sim`. It also shows up in the Test Lab select.
3. `npx vitest run tests/sims` validates every sim (ids exist, tier 1..3, positions fit and do not overlap, affix allowed for that enemy, no enemies with `waves: true`).

## Where the code lives

- `src/sims/_sim.ts`: the types, `defineSim`, defaults, `layoutCart` (auto-placement) and `validateSim`.
- `src/sims/_registry.ts`: the glob and the registry (`simRegistry.ids`, `.get(id)`, `.problems`).
- `src/state/sim.ts`: `createSimRun(sim)`, the pure run builder (no Phaser).
- `src/flow.ts`: `flow.startSim(sim)`, `flow.restartSim()`, `flow.sim`.
- `src/systems/spread.ts`: pure cluster / ring positions. The arena side is `ArenaScene.labSpawnAll`.
- `src/ui/simTag.ts`: HUD tag, notes, error card, `launchSim(id)`.
