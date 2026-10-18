# Sims

A sim is a Test Lab scenario in one file. It drops you straight into the arena (or the cart editor) with an exact cart, department, event and enemies, so you can playtest items, sets, enemies and bosses without clicking through the Test Lab form. Fixed seed, so every start is the same.

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
| `hp` | full HP | HP when the sim starts: a positive whole number, capped at the build's max HP. F9 applies it again. Use with `god: false`. |
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
   import { Enemy, Item } from '../engine/ids'; // item and enemy ids are typed constants, never bare strings (tests/content/ids-lint.test.ts)

   export default defineSim({
     id: 'my-sim', // same as the file name
     cart: [
       { id: Item.toaster, at: [0, 0] },
       { id: Item.fan, at: [2, 0] },
     ],
     enemies: [{ id: Enemy.milk, count: 6, spread: 'cluster' }],
   });
   ```

2. That is the whole registration: `import.meta.glob` collects every `src/sims/*.ts` that does not start with `_`. Reload and run `?sim=my-sim`. It also shows up in the Test Lab select.
3. `npx vitest run tests/sims` validates every sim (ids exist, tier 1..3, positions fit and do not overlap, affix allowed for that enemy, no enemies with `waves: true`).

## Combo sims

One sim per combo, `src/sims/combo-<id>.ts` with the combo id in kebab-case (`?sim=combo-bag-it`, `combo-five-alarm`, `combo-pot-slam`, ...). Each cart is exactly the combo's parts with an explicit `at`, so the recipe is active the moment it starts; the notes say what to look at. Shared choices: 7x5 cart, a cluster of 10 milk (immortal, so you can watch the effect for as long as you like), god mode on. Exceptions:

| Sim | Difference |
| --- | --- |
| `combo-bag-it`, `combo-clearance-sale` | 12 mortal milk (`immortal: false`): the effect needs kills (Bag It's charges) or crits (the Clearance coin). |
| `combo-smoothie-shield` | 3 walking spitters plus 4 milk: the shield eats their shots. |
| `combo-express-checkout`, `combo-pot-slam`, `combo-sugar-rush`, `combo-bag-it` | Dash with Space into the cluster (Sugar Rush has no weapon: the stacks and the SUGAR text are the test). |
| `combo-tailwind` | Adds an Energy Drink so Sugar Rush is active too (Tailwind feeds it). Walk while the leaf blower fires. |
| `combo-sour-mist` | The spray + fan is also Mist Machine, so both are active. |
| `combo-ray-gun` | Ray Gun replaces Nailstorm on the same nail gun, so only Ray Gun is active. |
| `combo-crack-open` | 8 immortal Canned Beans instead of milk (armor 3, so the Shred stacks change what lands). |

`tests/sims/sims.test.ts` checks that every combo sim activates its combo through `createSimRun` and `computeBuild` (and exactly the extra combos listed above), so an item change that breaks an adjacency shows up as a failing test, not a silent sim.

## Weapon sims

One sim per weapon, `src/sims/weapon-<id>.ts` (`?sim=weapon-toaster`, `weapon-pan`, `weapon-nailgun`, `weapon-vacuum`, `weapon-microwave`, `weapon-blender`, `weapon-fizz`, `weapon-mop`, `weapon-leafblower`, `weapon-laser`, `weapon-cooker`, `weapon-spray`). The cart is the weapon alone at ★3 (the legendary Laser has no tiers) at `[2, 1]`, no modules and no combo, so you see the bare pattern of `src/engine/patterns`. God mode on, dummies immortal unless the notes say otherwise. The notes name the ★3 damage and interval and what to look for:

| Sim | Enemies | Look for |
| --- | --- | --- |
| `weapon-toaster` | 8 milk in a bunch on the right | One toast per 0.8 s at the nearest enemy, one enemy per toast. |
| `weapon-pan` | ring of 12 milk | The 150° sweep hits only the half of the ring inside the arc. |
| `weapon-nailgun` | 8 milk in a bunch | Bursts of three nails, 0.08 s apart, each aimed at the nearest enemy then. |
| `weapon-vacuum` | 10 mortal milk | Suction toward the cart, the pulse every 0.52 s, coins flying in from 130 px (the +60 pickup radius). |
| `weapon-microwave` | milk and cereal bunch, a far Elite melon | The zap picks the Elite first, then the toughest, and splashes around it. |
| `weapon-blender` | 10 walking milk | The blade ring and the tick damage on whatever comes within 85. |
| `weapon-fizz` | three bunches of 4 milk | The cap bounces on to 2 more enemies within 230, never the same one twice. |
| `weapon-mop` | 10 walking milk | A puddle behind you every 1.28 s even with nobody around; the slow and 6 damage per 0.5 s. |
| `weapon-leafblower` | 8 milk by the right wall | The push (300) slams them into the wall for 16 extra damage. |
| `weapon-laser` | a far bunch and a ring of 5 milk | One beam down the line with the most enemies. |
| `weapon-cooker` | a big bunch right, a small one left | The pot goes to the densest group; the blast pushes everything back. |
| `weapon-spray` | 8 milk close in front | The 70° cone hits all of them each spray, with a light push. |

`tests/sims/sims.test.ts` checks that each weapon sim has exactly its weapon (★3, or ★1 for the legendary), an explicit `at`, notes and dummies, and that the build `createSimRun` computes carries the weapon's pattern with its base damage and interval scaled by the tier. Each weapon's behaviour in the patterns is tested in `tests/content/items/<weapon>.test.ts`.

## Enemy sims

One sim per regular enemy, `src/sims/enemy-<id>.ts` (`?sim=enemy-milk`, `enemy-banana`, `enemy-soda`, `enemy-spitter`, `enemy-baguette`, `enemy-egg`, `enemy-melon`, `enemy-turkey`, `enemy-beans`, `enemy-cereal`, `enemy-honey`, `enemy-giftcard`, `enemy-expired`, `enemy-gum`, `enemy-slice`, `enemy-sanitizer`). The dummy sandbox with the same neutral cart for all of them, a ★2 pan at `[1, 1]` and a ★2 toaster at `[3, 2]` (a melee and a ranged weapon, no module, no combo), god mode on, and 6 to 10 of that enemy walking at you. Compare numbers between sims: the same cart shows how armor (beans) or the shield (cereal) change what lands. The notes start with the enemy's HP and say what to look for. Immortal dummies unless the behaviour needs a death:

| Sim | Difference |
| --- | --- |
| `enemy-egg` | 6 mortal eggs: they explode next to the cart (8 damage to you, 12 to the other groceries in the 90 px ring) and die without credit. F9 for a fresh batch. |
| `enemy-melon` | 6 mortal watermelons: each bursts into 3 melon slices. |
| `enemy-giftcard` | 6 mortal gift cards: a kill pays 8x coins, every coin dropped. A dummy never escapes (a real card leaves after 8 s). |
| `enemy-gum` | 4 immortal gums that keep trailing puddles and 3 mortal ones that leave the trap when popped. |
| `enemy-honey` | 6 honey jars plus 4 mortal Soda Six-Packs in the same bunch, as heal targets (a jar never heals another jar). |
| `enemy-sanitizer` | The one sim with its own cart: a Toaster + Fuel Can (burn) with a Can Opener ★2 (shred) and a Sour Mist Spray Bottle (poison and Wet), against 2 immortal Sanitizers and 6 mortal Sour Milk in one bunch. Statuses vanish within 120 px of a Sanitizer, once a second, and stay on the milk further out. |

`tests/sims/sims.test.ts` checks that every regular enemy has its sim, that the cart is exactly the neutral one (the Sanitizer is the one exception), that each has 6 to 10 of its enemy, that the notes name the enemy's HP (so a stat change fails the test until the note follows) and which sims are mortal.

## Boss sims

One sim per boss, named after its department: `boss-main` (the Store Manager), `boss-frozen` (Walk-In Freezer), `boss-bakery` (Industrial Oven), `boss-electronics` (Smart-TV Wall), `boss-checkout` (Self-Checkout Kiosk). Each is `waves: true`, `aisle: 8` in the matching department (a real boss aisle with the director and the boss's summons), with the strong heat/electric cart of the plain `boss` sim, god mode on. The notes give the boss's HP, its move loop and the numbers of its signature move. `tests/sims/sims.test.ts` checks aisle, department and that the notes name the HP.

## Affinity sims

The element soft counters (docs/item-hooks-refactor.md "Affinity"), one sim per element, `src/sims/affinity-<tag>.ts`: a one-weapon cart (★3; the electric sim is the exception, an Electric L3 cart of Laser and Blender) and still, immortal groups of 3 or 4 that are weak to it, resist it or have no affinity, so the per-hit damage numbers (tinted orange or element-coloured when weak, dim grey when resisted) can be read side by side. The notes quote the numbers; `tests/sims/sims.test.ts` derives the cart's tags and each group's affinity from the real data and checks the quoted numbers against the build.

| Sim | Cart | Groups |
| --- | --- | --- |
| `affinity-heat` | Frying Pan ★3 (heat only) | baguette and turkey (weak), gum (resists), slice (none). Four bunches around the cart |
| `affinity-frost` | Fizz Cannon ★3 + Ice Pack (frost, slows) | banana and gum (weak), turkey (resists), slice (none). They walk, so the slow times (x1.5 / x0.5) show |
| `affinity-electric` | Electric L3: Laser + Battery + Blender + Power Strip. The Laser and Blender are electric themselves (declared `elements`), and so are the set's arcs | soda and beans (weak: beam 29, arc 15), milk (none: beam 22, arc 11). All stand on the beam's line |
| `affinity-blast` | Nail Gun ★3 (blast only) | milk and egg (weak), banana (none) |
| `affinity-cleaning` | Leaf Blower ★3 (cleaning only) | expired milk (weak), milk (none) |

`boss-stagger` is the boss weakness stagger: an immortal Walk-In Freezer dummy (weak to heat, so +40% and a 0.25 s stagger while it walks, once per 4 s) against a Frying Pan and a Pressure Cooker (heat). It is a sandbox, not a boss aisle, so it is not one of the five `boss-<department>` sims.

## Shred sims

Shred (docs/item-hooks-refactor.md "Shred"), one sim per source plus the Plated affix. Stacks show as orange diamonds left of the enemy's health bar; the numbers in the notes are damage per hit before rounding (the screen rounds). `tests/sims/shred-sims.test.ts` derives them from the real build and armor rule.

| Sim | Cart | Enemies | Look for |
|---|---|---|---|
| `shred-basic` | Toaster ★1 + Can Opener ★3 (9.5 per toast with the bundle bonus) | 4 Beans, 4 Milk | Beans 6.5, 7.5, 8.5, 9.5 as stacks build; milk 10.5, 11.5, 12.5. The +1 per stack is capped at half the hit |
| `shred-blast` | Pressure Cooker ★1 (16 per blast) | 4 still Beans, 4 still Banana | Every blast leaves 1 stack, no Can Opener: Beans 13, 14, 15, 16; Banana 16, 17, 18, 19 |
| `shred-tools-dash` | Tools L3 (Nail Gun, Magnet, Boot, Tape) | 6 still Beans | Dash (Space): 0.45 s stun and 3 stacks on every enemy it hits (L2 would leave 2) |
| `combo-crack-open` | Nail Gun + Can Opener ★1 | 8 Beans | Every 3rd nail on the same enemy adds 2 stacks to the Can Opener's 50% roll |
| `elite-plated` | Toaster ★1 | 2 plated Milk, 2 plated Beans, 2 plain Beans | Plated milk takes 6 of 9, plated beans 3, plain beans 6. F8 and add a Can Opener to strip the plating |

## Weaken and armor sims

Weaken and the armor pass (docs/item-hooks-refactor.md "Weaken", "Armor"). A lavender down-arrow right of an enemy's health bar shows the weaken. The Weaken sims turn god mode OFF (`god: false`, full HP) and keep the groceries immortal, so their hits land on your HP bar; for a "without" run press F8, take the module or weapon out of the cart and fight the same crowd. `tests/sims/weaken-sims.test.ts` derives the numbers from the real build and rules.

| Sim | Cart | Enemies | Look for |
|---|---|---|---|
| `weaken-decaf` | Toaster ★1 + Decaf ★3 | 3 Sour Milk, 1 Baguette, 1 Spitter (walking) | -25% for 3 s per toast: contact 4 becomes 3 and 5 becomes 4, the Baguette swipe 7 becomes 5, a Spitter bubble 5 becomes 4 (fixed when fired) |
| `weaken-cleaning` | Spray Bottle ★1 + Leaf Blower ★1 + Desk Fan (Cleaning L2) | 3 Sour Milk, 2 Baguette (walking) | -20% for 2 s on every cleaning hit, the quiet spray cone included: it fires every 0.55 s, so what it touches stays weakened |
| `armor-turkey` | Nail Gun ★3 | 4 still Frozen Turkey, 4 still Banana | 6 per nail on the Banana, 4 on the Turkey (armor 2). F8 and add a Can Opener to strip it |

The armor pass also changes the `enemy-turkey`, `boss-frozen` and `boss-checkout` notes (they name the armor), and the notes of `affinity-heat`, `affinity-frost` and `boss-stagger` (their quoted numbers are before the Turkey's / Freezer's armor).

## Wet sims

Wet (docs/item-hooks-refactor.md "Wet"). Blue droplets drip down a wet enemy. God mode stays on. `tests/sims/wet-sims.test.ts` derives the numbers from the real build.

| Sim | Cart | Enemies | Look for |
|---|---|---|---|
| `wet-electric` | Spray Bottle + Blender + Toaster + Vacuum + Battery (Electric L3) | 10 Sour Milk in a bunch | Blender hits are x1.2 on a wet milk. A toast arcs to 3 more enemies, 4 when the milk it hit is wet |
| `wet-frost` | Spray Bottle + Ice Pack + Mop (Frost L2) | 6 Sour Milk, 3 Beans | The spray's Ice Pack slow is 35%, 45% on a wet enemy; the Frost freeze is 10% on a dry slowed enemy, 20% on a wet one |
| `wet-steam` | Spray Bottle + Toaster + Fuel Can | 6 Sour Milk, 2 Baguette | A burn on a wet enemy lasts half as long and dries it (the droplets vanish); dry enemies get the full burn |

## Reaction sims

Element reactions (docs/item-hooks-refactor.md "Reactions"). A teal name pops over the enemy and the burst's damage numbers are teal. Each enemy reacts at most once per second (Shatter: once per 3 s). God mode stays on; the groceries are immortal except in `reaction-crack`. `tests/sims/reaction-sims.test.ts` runs each cart headless and checks its reaction goes off.

| Sim | Cart | Enemies | Look for |
|---|---|---|---|
| `reaction-shatter` | Toaster ★1 + Fuel Can + Ice Pack | 8 Sour Milk in a bunch | Burn and slow on every toast: SHATTER! with a burst of 8 + half the toast, the burn and the slow gone; the same enemy shatters again only after 3 s |
| `reaction-fumes` | Toaster ★1 + Fuel Can + Expired Milk | 10 Sour Milk in a bunch | A burning milk that walks into the aura bursts into a green cloud (radius 60, 2 s) that poisons its neighbors |
| `reaction-conduct` | Spray Bottle ★1 + Laser ★1 | 10 Baguettes in a bunch | The Laser beam on a wet baguette (x1.2) jumps to the 3 nearest for 60%, the Wet is gone |
| `reaction-crack` | Pressure Cooker ★1 + Can Opener ★3 + Party Popper | 10 Beans (mortal) | A blast on a Beans with 3 Shred stacks throws shrapnel at the 3 nearest within 90 px (+1 Shred each) |

## Where the code lives

- `src/sims/_sim.ts`: the types, `defineSim`, defaults, `layoutCart` (auto-placement) and `validateSim`.
- `src/sims/_registry.ts`: the glob and the registry (`simRegistry.ids`, `.get(id)`, `.problems`).
- `src/state/sim.ts`: `createSimRun(sim)`, the pure run builder (no Phaser).
- `src/flow.ts`: `flow.startSim(sim)`, `flow.restartSim()`, `flow.sim`.
- `src/systems/spread.ts`: pure cluster / ring positions. The arena side is `ArenaScene.labSpawnAll`.
- `src/ui/simTag.ts`: HUD tag, notes, error card, `launchSim(id)`.

## Item sims

Sandboxes for items with a mechanic you have to see, `src/sims/item-<id>.ts`:

| Sim | Cart | Look for |
|---|---|---|
| `item-bowling-ball` | Toaster, Bowling Ball, Helium Balloon, Running Boot | Dash damage 6 + 6 + 1 per occupied cell, +50% knockback; the Balloon touching the Ball makes the Ball's cells weightless for the slow |
| `item-ghost-pepper` | Toaster, Fuel Can, Ghost Pepper (god mode off, 3 milk) | BURNING over the goblin after a hit: 1.5 dps over 2 s, no flinch, no i-frames, never below 1 HP |
| `item-scratch-ticket` | Toaster, Scratch Ticket (god mode off, a real aisle) | The aisle-start roll: 1 in 5 for +30 coins, else -4 HP. A sim boots the arena twice, so the roll can fire twice |
| `item-dash-boot-bumper`, `item-dash-ball` | Pan ★1 plus Boot + Bumper (5 cells) / plus a Bowling Ball with 12 Piggy Banks as filler (19 cells) | The same milk cluster: switch between them to compare the dash. Boot + Bumper: 12 + an 8 blast. Ball: 25 on every enemy touched |
