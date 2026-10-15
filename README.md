# Goblin Grocery

A single-player browser roguelite. A goblin pushes a shopping cart through a cursed supermarket and fights waves of angry groceries with household weapons. Between waves you arrange what you bought inside the cart to unlock adjacency combos.

Built with Phaser 3.90, TypeScript and Vite. The HUD, shop and menus are HTML/CSS driven from one shared run state.

## Setup and run

You need Node 20 or newer; it was developed on Node 24.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload. Dev-only shortcuts are enabled. |
| `npm run build` | Type-checks, then writes a production build to `dist/` (relative paths, so it can be hosted statically). |
| `npm run preview` | Serves the production build. |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm test` | Runs the Vitest rule tests: inventory, adjacency, recipes, shop economy, tiers and hit policies. |
| `npm run assets` | Regenerates every SVG (`tools/gen-assets.mjs`) and WAV (`tools/gen-audio.mjs`). |

Playtest scripts need a running dev server. They use your installed Google Chrome through Playwright, so no browser download is needed.

```bash
node tools/playtest.mjs http://localhost:5173/ 1440 900
```

`tools/playtest.mjs` is a scripted smoke test. It takes screenshots at a given viewport size.

```bash
node tools/botrun.mjs http://localhost:5173/ 3
```

`tools/botrun.mjs` runs a kiting bot through full runs and logs per-wave stats. Use it for balance checks.

```bash
node tools/victory-check.mjs
```

`tools/victory-check.mjs` checks the boss victory path.

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Push the cart. Diagonals are normalized. |
| Space | Cart shove: a short dash that knocks enemies back, with brief contact protection and a 3 s cooldown. |
| Tab | Read-only cart view. It pauses the game. |
| Esc | Pause and settings. While you are dragging an item, Esc cancels the drag first. |
| Mouse (shop) | Drag items between the cart, the staging shelf and the sell zone. Click an item to inspect it. |
| R (while dragging) | Rotate the held item 90°. |

Weapons fire automatically. Losing window focus pauses the game, and you need to click Resume to continue.

**Dev-only shortcuts** (on in `npm run dev` and in the test app from `npm run launch:test`, which also opens with the Test Lab; stripped from normal builds):

| Key | Action |
|---|---|
| F2 | End the current wave. |
| F3 | Jump to the boss with a developed build (Shift+F3: the aisle 4 mini-boss). |
| F4 | Stress test: 70 enemies and 150 projectiles. |
| F6 | +100 coins (also in the shop). |
| F7 | +500,000 coins (also in the shop). |

**Test Lab** (any build, gated by a launch flag): adds a "Test Lab" button on the title screen to jump to any aisle, department, shift, character and weapon with a hand-built cart (item palette, god mode, "Back to Lab" after each attempt). Lab runs never touch your progress, and the dev shortcuts above are on too.

| Where | How |
|---|---|
| Dev | http://localhost:5173/?lab=1 |
| macOS | `open "release/mac-arm64/Goblin Grocery.app" --args --lab`, or `npm run lab` to rebuild and launch |
| Windows | `"Goblin Grocery.exe" --lab` |
| Steam | Launch options: `--lab` |

## Run structure

There are 7 aisles of 60 s each (enemies spawned later in an aisle are tougher, and groups get denser), then the boss, The Store Manager, in aisle 8. The boss enrages after 60 s. You get a shop after every aisle:

- 4 offers
- rerolls that cost 2, 4, 6…
- one repair for 8 coins
- a staging shelf with 4 slots
- a sell zone that pays half of the item's value

The Loyalty Card is a shop upgrade with levels 1 to 4. Higher levels raise the odds of pre-upgraded (★2/★3) and legendary offers and add a free reroll.

## Content

All balance values live in `src/data/`.

### Items (31)

| Kind | Items |
|---|---|
| Weapons | Toaster, Frying Pan, Nail Gun, Vacuum, Microwave, Blender, Fizz Cannon, Mop, Pressure Cooker (AOE mortar), Spray Bottle (multi-hit cone), *Self-Checkout Laser* |
| Modules | Desk Fan, Fuel Can, Battery, Ice Pack, Hot Sauce, Price Gun, Duct Tape, Party Popper (kills explode), Double Bag (hits strike twice), Multipack (+1 projectile / extra swing), *Power Strip*, *Gold Star Sticker* |
| Passives | Magnet, Lunchbox, Shopping Bell, Running Boot, Coupon Book, Bubble Wrap, Energy Drink, *Family-Size Snack Bag* |

Items in *italics* are legendary.

### Upgrades and synergy

- **Levels:** combine two identical items to level up: ★1+★1 → ★2, ★2+★2 → ★3. Drop one onto the other, or click **Combine** in the item panel; items with a partner show a ▲2 badge. Border colour shows rarity: cream (common), teal (★2 rare), violet (★3 epic) and gold (legendary, can't be combined).
- **Character + starting weapon:** when you press Play, pick a starting weapon (Toaster or Frying Pan; key `W` toggles, remembered) and one of four goblins (keys 1-4), each with a stat-only perk (`PLAYER.starters`, `STARTER_WEAPONS` in `src/data/items.ts`). Toast Goblin is the all-rounder; Line Cook (+5 max HP, -5% speed) is open from the start; Coupon Clipper (cheaper shops, +12 coins, -8 max HP) unlocks at 400 lifetime coins; Night Shift (+8% speed, faster dash, -10% weapon damage) unlocks at aisle 6. Shop 1 always offers two items that suit the chosen weapon.
- **Store services:** a bigger cart (5×4 → 6×4 → 6×5 → 7×5) and extra shelf slots (4 → 6), always for sale with rising prices.
- **Bundle Deal:** every weapon gets +6% damage per distinct item type touching it.
- **Combos (10):**
  - Toast Mode
  - Nailstorm
  - Cold Storage
  - Express Checkout
  - Brain Freeze
  - TV Dinner
  - Clearance Sale
  - Grease Fire
  - Pressure Point
  - Mist Machine

  Each combo is an exact adjacency rule. Hover a combo in the shop to see it.

### Themes and aisle modifiers

Pick one **theme** on the start screen (`T` cycles). All aisles use it, and its enemies dominate the roster:

| Theme | Hazard |
|---|---|
| Main Aisle | none |
| Frozen Foods | ice patches |
| Bakery | oven vents |
| Electronics | live cables that stun enemies |
| Checkout Lanes | conveyor belts |

Hazards hurt groceries too, and grow with the aisle number. After every shop you pick an **aisle modifier** from 2-3 doors: Regular, Rush Hour (more groceries and coins), Quiet (fewer of both), Aisle Event (guaranteed event, free reroll) or, rarely, Clearance Sale (tougher, guaranteed legendary). The Store Manager's summons are partly themed. Rules and numbers are in [docs/departments.md](docs/departments.md).

### Enemies

**Elites:** from aisle 3, any grocery (except the boss, Egg Cartons and Melon Slices) can spawn as a gold-ringed Elite: bigger, 3.5x HP, 1.5x damage, 3x coins. Chance grows per aisle and shift (`ELITE` in `src/data/enemies.ts`).

| Enemy | Behaviour |
|---|---|
| Sour Milk | basic |
| Banana Bandit | telegraphed lunge |
| Soda Six-Pack | tank |
| Detergent Spitter | ranged bubbles |
| Baguette Bruiser | telegraphed swipe wedge |
| Egg Carton | walks up, swells, then explodes in a ground ring (kill it first); aisles 5+ |
| Watermelon | tanky; splits into 3 fast Melon Slices when killed; aisles 6+ |
| Frozen Turkey | slow, very tanky, hits hard; aisles 4+ |
| The Store Manager | boss: receipt volleys, conveyor charge and summons; faster at half HP; enrages after 60 s |

## Obstacles

Every aisle gets 2-4 themed props (gondolas, chest freezers, bread racks, TV boxes, lane dividers, bargain bins; the manager's aisle has two desks), laid out from one of a few per-department templates (`src/data/obstacles.ts`). They are solid: you and the groceries walk around them, and you can always get past without dashing. **Dash (Space shove) to vault over them** and land on the far side. Projectiles fly over, coins bounce off, and the Store Manager ignores them.

## Aisle events

At most one event per aisle (never the boss aisle), rolled per department; numbers live in `src/data/events.ts`, the roll in `src/systems/events.ts`, the behavior in `src/scenes/events.ts`.

- **Wet floor** (aisle 2+): a mop robot drives 1-3 streaks across the aisle and leaves blue puddles. They slow the goblin (not the shove) and groceries, and dry after about 12 seconds.
- **Power outage** (aisle 3+, most likely in Electronics): the store goes dark except for the cart's headlight cone and a small glow around you. Enemy eyes and shots still glow. It lasts longer on later shifts. With Reduced motion the flicker is a plain fade.

The Test Lab has an **Event** option to force one (or none).

## Shifts & Overtime

Pick a **Shift** (1-5, `SHIFTS` in `src/data/waves.ts`) on the start screen. Higher shifts multiply enemy HP, speed and count, cut coin income, and toughen the boss (more receipt volleys, tougher summons, earlier enrage; `boss` overrides on `SHIFTS`). Shift N unlocks per character by winning Shift N-1 with it.

After beating the Store Manager, **Keep going: Overtime** continues the same run: normal departments only, endless aisles that scale off the last regular wave (`waveDef`). The run is counted once at victory; an Overtime defeat only updates `bestOvertime` (aisles past the Manager).

## Meta-progression

Progress persists between runs in local storage (`src/state/profile.ts`, rules in `src/data/unlocks.ts`).

| Feature | How it works |
|---|---|
| **Catalog** (main menu) | A combo is discovered the first time it's active in your cart, with a pop-up. Undiscovered combos show the weapon plus `?` slots. The Items tab shows every item, with requirements and progress bars for locked ones. |
| **Unlocks** | Start with 12 items. Unlock the other 19 by reaching aisles, clearing departments, lifetime kills and coins, discovering combos, and winning. Locked items never appear in shops. |
| **Wardrobe** | 3 goblin skins (Night Shift, Freezer Burn, Employee of the Month) and 2 cart skins (Sale Cart, Golden Cart) unlock through milestones. |

The end-of-run receipt lists anything that run unlocked.

## Project layout

```
src/
  types.ts            shared data contracts
  data/               items, recipes, enemies, waves/economy, asset manifest
  state/              run state (single source of truth), settings + best run
  systems/            pure rules: inventory, synergies (computeBuild), shop, combat hit policies, rng
  scenes/             Phaser: Boot, Arena (+ enemies, weapons, fx)
  ui/                 DOM controllers: HUD, shop, menus, styles
  audio/              throttled SFX playback
tools/                asset generators, playtest bots
tests/                Vitest rule tests
public/assets/        generated SVG + WAV assets
```

See `ASSETS.md` for asset provenance and [docs/departments.md](docs/departments.md) for departments, hazards and route choice (with example runs).

## Desktop build (Electron, for Steam)

`electron/main.cjs` wraps the production build. It serves `dist/` over a private `app://` scheme, has no Node access in the page, and only lets the page quit and toggle fullscreen. The desktop build adds Quit buttons, a Fullscreen setting and F11.

To build and run locally:

```bash
npm run desktop
```

To build the macOS app (`release/mac-arm64/`, unsigned):

```bash
npm run dist:mac
```

To quit a running copy, rebuild and open the app in one step:

```bash
npm run launch
```

To build on Windows (`release/win-unpacked/`):

```bash
npm run dist:win
```

To build Linux (`release/linux-unpacked/`):

```bash
npm run dist:linux
```

To check that the packaged macOS app boots and plays:

```bash
node tools/electron-check.mjs
```

The targets are unpacked `dir` folders because SteamPipe uploads folders. Build Windows on Windows or in CI. Release macOS builds need a Developer ID signature and notarization; local builds skip signing. The app icon is `build/icon.png`, made with `npm run icon`.
