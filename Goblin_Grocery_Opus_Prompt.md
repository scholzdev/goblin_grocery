# Goblin Grocery — implementation prompt for Opus 5.5

Copy everything below the divider into your coding agent. Attach the latest supermarket concept image from this conversation if possible. The reference is art direction, not a finished UI specification; this prompt is also self-contained without it.

---

You are building **Goblin Grocery**, a polished, playable single-player browser roguelite. Work as a game programmer and art director. Implement the game in the workspace, run it, inspect it visually, and fix issues. Do not stop at a design document, scaffolding, a static mockup, or a menu with a fake Play button.

## 1. The game in one sentence

A mischievous goblin pushes a shopping cart through a cursed supermarket, survives waves of angry groceries using improvised household weapons, and arranges purchases inside the cart to discover powerful adjacency combinations.

The appeal is threefold: satisfying automatic combat with active dodging; a tactile inventory puzzle between waves; and visibly absurd combinations such as a toaster, desk fan, and fuel can becoming a flaming-toast launcher.

Brotato is a reference for immediate movement, readable waves, and frequent purchasing decisions. Backpack games are a reference for spatial build planning. Give this game its own supermarket world, character silhouettes, interface, and combat effects. It must look like a deliberately art-directed indie game.

## 2. Deliver a focused vertical slice

Build one complete, replayable run:

- One attractive supermarket arena, approximately 1,280 × 800 world units, with an open combat floor and shelves framing the perimeter.
- One playable goblin/cart unit.
- Eight waves: waves 1–7 last 35 seconds; wave 8 is a boss encounter, with a soft enrage after 60 seconds rather than automatic victory.
- Seven shops between waves. A run should take roughly 7–10 minutes including shopping.
- Twelve purchasable item types, four named combinations, five regular enemy types, and one boss.
- Start screen, controls, pause/settings, victory, defeat, and instant restart.
- A score/best-run record in local storage. No permanent stat grind is needed.

Build these systems fully before adding extra characters, biomes, procedural maps, crafting tiers, quests, online systems, or controller/mobile support. If scope becomes tight, reduce content before sacrificing the movement, inventory interactions, sound, or visual consistency. Report any actual reductions clearly.

## 3. Technology and project structure

Use **Phaser 3, TypeScript, and Vite**. Use a compatible stable Phaser 3 release, pin dependency versions, and keep a lockfile. Check installed-version documentation; do not mix Phaser 4 examples into Phaser 3 code. Use npm scripts for development, build, type checking, and tests. Start from a minimal project or the compatible official template, removing unnecessary demonstration code and optional template telemetry.

- Phaser handles the arena, sprites, collision, animation, input, particles, and sound.
- Use HTML/CSS with small TypeScript controllers for the receipt HUD, shop, inventory, tooltips, and menus. Keep a single authoritative game state; DOM and Phaser must not each maintain competing inventories or money balances.
- Arcade Physics or simple kinematic circle collisions are enough. The cart is one responsive player body, not a realistic wheeled vehicle with articulated physics.
- Use local PNG/WebP atlases and source SVGs where appropriate. Bundle assets locally; no runtime CDN dependency.
- Use Phaser audio for bundled samples, with small synthesized Web Audio effects as a fallback. Unlock sound on the first user gesture.
- Use Vitest for pure rules that can silently break the game; use browser automation if available to check the playable application.
- No backend, account system, external API, paid dependency, Blender pipeline, or 3D engine is required.

Suggested modules: `data/items`, `data/enemies`, `data/waves`, `state/run`, `systems/combat`, `systems/inventory`, `systems/synergies`, `systems/shop`, `scenes/BootScene`, `scenes/ArenaScene`, `ui/`, and `assets/`. Keep balance values in typed data, not scattered through rendering code. Avoid an oversized framework or generic ECS for this small game.

## 4. Run flow and controls

Flow: title → first wave → results/shop → next wave → final boss → victory/defeat → restart.

- WASD and arrow keys move. Normalize diagonals. Movement should respond immediately; a tiny visual cart lag is acceptable, mechanical steering friction is not.
- Weapons automatically acquire valid targets and fire while moving. Mouse aiming is not required.
- Space performs a short shopping-cart shove: approximately 130 units over 0.16 seconds, a three-second cooldown, light impact damage and enemy knockback, and brief contact-damage protection. Stop at walls. Show its cooldown plainly.
- Escape pauses and opens settings. Losing window focus pauses combat; returning requires a clear resume action.
- Mouse interactions edit inventory only during shops. R rotates the currently held item by 90 degrees. Escape cancels the drag before it opens another menu.
- Provide a brief dismissible first-run hint. Start action within one click of Play.

Start with 40 maximum HP, full health, a Toaster, and a Frying Pan already fitted into the cart. Contact damage grants 0.6 seconds of global invulnerability; flash the character clearly. Small HP bars appear on damaged tougher enemies rather than cluttering every sprite.

Non-boss wave completion requires surviving until the timer expires. Clear leftover enemies and hostile projectiles with an obvious checkout transition, automatically collect remaining coins, and disable combat input before opening the shop. Do not award kills for enemies removed by this transition. Repair 6 HP between waves, capped at max HP. On the boss wave, victory requires defeating the boss.

## 5. Combat should feel good with very little content

Use a flat 2D simulation with a slight three-quarter view in the artwork. Avoid a true isometric movement grid. Sort sprites by their ground-contact Y coordinate. Draw shadows separately. Keep the full arena visible at the target desktop aspect ratio and letterbox as needed.

The goblin and cart move as one unit. The goblin remains visually at the handle; use left/right facing with motion bobbing and wheel rotation. Never rotate an entire painted character sprite upside down to follow movement. Show up to three equipped weapon props in the cart, prioritizing the active signature combination. Remaining items are represented in the loadout UI.

Weapons need distinct rhythms: toast volleys, broad pan sweeps, short nail bursts, and brief vacuum pulses. Provide recoil, a short hit flash, restrained knockback, tiny impact particles, a readable enemy death animation, and a pleasing coin pickup sound. Limit damage numbers and overlapping sounds. Avoid full-screen flashes or strong camera shake; offer reduced motion/shake settings.

Give each attack an unambiguous hit policy: ordinary toast hits one enemy once; sweeps hit each enemy once per swing; piercing projectiles track already-hit enemies; damage-over-time uses a fixed tick interval. Remove expired projectiles. Bound effect counts and use pooling where useful. Aim for 60 FPS on a typical laptop with about 70 active enemies and 150 projectiles, measuring rather than claiming untested performance.

## 6. Inventory rules: the main build system

The cart is a **5-column × 4-row grid**. Each item has a unique instance ID, a type ID, an origin, and a footprint defined by integer cell coordinates. Represent footprints generically even though the initial items are rectangular.

- Items may rotate in 90-degree steps; symmetric rotations must behave sensibly.
- Items cannot overlap or leave the grid.
- Adjacency means at least one occupied cell shares an orthogonal edge with a cell from the other item. Diagonal touching does not count.
- A pair of items is adjacent once even if several edges touch; never multiply buffs by shared-edge count.
- Hovering or dragging previews affected items, legal cells, and resulting combinations. Use outlines and icons as well as color.
- Invalid drops restore the original item position without losing money or the item.
- A four-slot staging shelf holds purchased items between arrangements. Each shelf slot holds one whole item regardless of footprint. Shelf items provide no combat effects, persist between shops, and may be sold later.
- Purchasing requires enough money and a free staging slot. Explain blocked purchases. Never delete an item to make room.
- Equipped items cannot be moved during combat; opening a read-only loadout view pauses the game.

Recompute the build from base item definitions after each valid inventory change. Never incrementally add bonuses in ways that retain stale buffs. Keep combat stats and displayed tooltip stats synchronized. Store active combinations explicitly so the UI can explain exactly why they work.

## 7. Initial item roster

These are starting balance values, not sacred numbers. Tune them after playtesting while preserving identities. Sizes are pre-rotation. All times use seconds and distances use world units.

| Item | Size | Price | Base behavior |
|---|---|---:|---|
| Toaster | 2×1 | 12 | Fires toast for 7 damage every 0.9 s; 440 range |
| Frying Pan | 1×3 | 10 | Sweeps toward nearby enemies for 12 damage every 1.15 s; 110 reach |
| Nail Gun | 2×1 | 16 | Fires a three-nail burst every 1.1 s; 3 damage per nail; 480 range |
| Vacuum | 2×2 | 18 | Pulses every 1.3 s, drawing nearby enemies slightly inward and dealing 4 damage; increases coin pickup radius by 60 |
| Desk Fan | 1×2 | 9 | Adjacent projectile weapons gain 25% projectile speed and range |
| Fuel Can | 1×2 | 11 | Adjacent Toasters inflict burn: 2 damage/s for 2 s; repeat hits refresh duration |
| Battery | 1×1 | 8 | Adjacent electrical weapons gain 15% attack rate; electrical weapons are Toaster, Nail Gun, Vacuum |
| Magnet | 1×1 | 7 | Increases pickup radius by 50; enables Nailstorm |
| Ice Pack | 1×2 | 8 | Adjacent weapon hits slow enemies by 20% for 1 s; repeated hits refresh |
| Hot Sauce | 1×1 | 7 | Adjacent weapons gain 15% direct hit damage |
| Lunchbox | 2×1 | 9 | Adds 10 maximum HP while equipped |
| Shopping Bell | 1×1 | 7 | Shove cooldown reduced by 0.5 s; enables Express Checkout |

Each individual buff type applies at most once per affected weapon, even if multiple identical modules touch it. Distinct buff types can combine. Multiple magnets, lunchboxes, and bells do not stack their global passive. Max-HP changes clamp current HP downward when necessary but do not heal when the Lunchbox is re-equipped; prevent inventory-based infinite healing.

## 8. Four visible combinations

Adjacency chains are not vague flavor text. Implement these exact predicates and show a concise explanation when hovering their badge. Modules remain in the cart; recipes do not consume or merge them. A module can support multiple adjacent weapons.

1. **Toast Mode:** a Toaster directly touches both a Desk Fan and a Fuel Can. Replace its single shot with a three-toast spread. Each projectile deals 60% of normal direct damage and applies the Fuel Can burn. Fan speed/range benefits still apply. Different projectiles may hit the same target, but burn does not stack. Use orange toast trails and a distinct toaster pop.
2. **Nailstorm:** a Nail Gun directly touches both a Magnet and a Battery. Each nail pierces one additional enemy and curves slightly toward a nearby target after the first hit. Battery attack-rate benefit still applies. Use tiny teal sparks and an obvious three-shot rhythm.
3. **Cold Storage:** a Vacuum directly touches an Ice Pack. Its pulse creates a short frost ring that slows affected enemies by 40% for 1.5 s. This replaces the weaker Ice Pack slow for that attack; never add the slows together.
4. **Express Checkout:** a Frying Pan directly touches a Shopping Bell. A successful shove triggers one additional pan sweep with a 1.0 s internal cooldown. The bell's base shove cooldown reduction still applies. Use a checkout ding and a receipt-shaped impact accent.

Do not let recipe resolution recurse or multiply its own derived stats. Show active recipe icons during combat; reserve the full explanations for the shop.

## 9. Shop and economy

The shop is a dedicated full-screen phase, not a permanently huge sidebar that squashes the arena. The concept image shows both mechanics together; translate this into a usable game flow.

Layout: receipt summary on the left, large editable cart in the center, four purchase cards and staging shelf on the right, a clear next-wave button at the bottom. At smaller desktop widths, adapt proportions without shrinking item names into unreadability.

- Kills yield coins; start with one coin per basic enemy, more for elites. Begin balancing around 15–25 kill coins per wave plus a guaranteed 12-coin wave-clear bonus.
- Four shop offers, without duplicate types within the same refresh. Owned duplicates may appear and may be purchased.
- First reroll in each shop costs 2 coins, then 4, then 6, and so on; reset this cost each shop.
- Sell for half the original purchase price, rounded down. Starting items use their listed base prices for resale.
- One optional 8-coin repair per shop restores 10 HP, capped at max HP.
- The first shop guarantees a Fan and Fuel Can so the signature recipe can be discovered. Later offer weighting mildly favors modules compatible with owned weapons but must retain variety.
- Hover cards show footprint, stats, adjacency effects, price, and known recipe hints.
- Sell through an explicit drop zone with a clear price preview. Purchases, sales, and rerolls must be atomic and immune to repeated pointer events.

Money persists only within the run. Show where coins came from and what changed after a purchase. A receipt should feel tactile and delightful rather than like a spreadsheet.

## 10. Enemies and boss

All enemies are cursed grocery products with different silhouettes, not generic blobs with new colors:

- **Sour Milk:** tall squat milk carton, simple pursuer; introductory enemy.
- **Banana Bandit:** angular banana peel with long legs; stops, shows a clear charge tell, then lunges in a locked direction.
- **Soda Six-Pack:** low wide cluster of cans; a slower tank with strong knockback resistance.
- **Detergent Spitter:** wide bottle with handle silhouette; keeps distance and launches slow, readable bubbles with expiration timers.
- **Baguette Bruiser:** long bread body; telegraphs a short wide melee swipe with an outlined floor wedge.

Introduce one behavior at a time over early waves. Use a wave budget and composition table instead of spawning every type immediately. Scale health moderately; difficulty should come mainly from combinations of enemy behaviors, not bullet sponges. Cap active enemies and defer excess spawns rather than causing a performance spike. Spawn only at marked perimeter entry points with a brief tell; do not appear inside the player.

Boss: **The Store Manager**, a large possessed checkout register on squeaky wheels. It alternates telegraphed receipt-paper volleys, a conveyor-belt charge, and summoning small grocery enemies. At half HP it combines attacks slightly faster. Make damage windows readable. Add a boss HP bar, substantial defeat reaction, and a satisfying victory receipt listing the run's build and results.

## 11. Art direction — treat this as a requirement

Match the attached latest **Goblin Grocery supermarket** concept if available. Ignore the earlier brown junkyard/Brotato-like version.

Visual identity:

- Angular, wonky, cut-paper cartoon shapes; restrained dark plum edge accents; mostly flat colors with one shadow tone.
- Mint and cream supermarket floor, lavender shadows, coral price labels, aubergine outlines, gold pickups, fresh green goblin.
- Starting palette: mint `#B8DED2`, cream `#FFF2D5`, coral `#F45F52`, plum `#30203F`, lavender `#9081B6`, goblin green `#8FCB57`, gold `#F5BD45`.
- Goblin: oversized triangular ears, pointed nose, expressive eyebrows, tiny apron, oversized sneakers. Distinctive silhouette at gameplay size.
- Wire shopping cart with a simplified readable basket, four wheels, visible handle, and recognizable weapon props. Avoid drawing every wire at tiny scale.
- Supermarket framing: freezer units, colorful shelf blocks, fallen cereal display, occasional wet-floor sign, crooked sale signage. Keep the central floor quiet enough to read enemies and attacks.
- Receipt UI with torn-paper edges, printed rules, barcode accents, coral offer stickers, and large legible prices. Use a licensed locally bundled display font plus a clean UI font, with fallback fonts.
- Default screen composition must breathe. Combat HUD stays compact; inventory gets space only during shopping.

Avoid brown wasteland arenas, potato-shaped enemies, thick black outlines everywhere, stock Bootstrap dashboards, generic neon/glass UI, emoji item icons, realistic 3D, tiny illegible text, and a full-screen static illustration masquerading as gameplay.

## 12. Asset production and consistency

Create actual reusable assets and integrate them. Do not end with colored circles, rectangles with labels, or a pile of unrelated downloaded art. Simple shapes may be used during the first mechanical spike, then replaced.

Choose one coherent production route based on available tools:

**Preferred when image generation is available:** generate small separate transparent-background assets in one consistent style. Use the concept as a reference. Generate the goblin, cart, enemies, item icons, and props as isolated assets; inspect alpha edges and remove baked backgrounds where needed. Keep camera angle, light direction, outline weight, and scale consistent. Do not request an enormous packed sprite sheet and assume it will have exact frame boundaries. Never crop the screenshot into a playable background with baked-in enemies or UI.

**If image generation is unavailable:** author polished original SVG assets with intentional silhouettes, layered fills, expressions, shadows, and restrained texture, then rasterize/load them as game textures. This graphic direction can work well with carefully drawn vectors. Spend effort on reusable character parts and consistent icons. Use polygon primitives as building blocks for finished artwork, not as the entire visual design. Do not pretend a generation tool was used if it was not.

Minimum asset set:

- Goblin body/head/arms and cart body/wheels as separate layers, left/right facing support, a hit expression, and a shove pose.
- Five enemy bodies with idle/walk motion and attack tells; use two-to-four frames or deliberate transform animation instead of requiring expensive full animation sheets.
- Twelve consistent inventory icons, ideally 128–256 px source size, readable at about 56–72 px display size.
- Three signature weapon props plus the cart's base equipment representation.
- Floor tile, four shelf/freezer variations, three decorative props, and entry markers.
- Toast, nail, bubble, pan sweep, frost ring, sparks, coins, and small impact/death particles.
- Reusable receipt panel pieces, card frames, price stickers, hearts, settings icons, and cursor/drag highlights.

Player and enemy sprites should have known ground anchors; keep collision shapes smaller than broad ears or decorative details. Separate shadow sprites from bodies. Keep export names deterministic and record source, generation method, and license/provenance in `ASSETS.md`. Generated concept art is a direction reference, not proof that downloadable production sprites exist.

Audio: cart-wheel rattle at low volume, toaster pop, pan clang, nail burst, coin plink, checkout ding, UI click, hurt, death, and victory. Add a quiet playful loop only if a suitable locally usable source or competent original loop is available. Prioritize good effects over bad music. Prevent high-rate attacks from stacking dozens of identical sounds. Expose master/music/effects volume and remember settings.

## 13. Implementation sequence

1. Inspect the workspace and existing instructions. State a short plan, choose concrete asset production methods, then begin implementation without asking me to pick every detail.
2. Build a representative finished-looking sample scene: floor, shelf edge, goblin/cart, two enemies, compact HUD. Establish scale and palette early rather than promising to fix visuals at the end.
3. Make movement, auto-attacks, shove, damage, drops, one wave, and death work. Play this before scaling content.
4. Implement the grid, rotation, staging shelf, purchases, sales, adjacency engine, and Toast Mode. Verify the full fight → shop → changed build → fight loop.
5. Add the remaining scoped items, combinations, enemies, wave director, and boss using the same data model.
6. Complete animation, sound, menu transitions, tooltips, damage readability, pause/settings, victory, and restart.
7. Build, playtest, capture screenshots, and iterate on the weakest visual and mechanical issues. Finish with a runnable project and honest validation report.

Make sensible local decisions. If an asset tool is unavailable, use the defined fallback. If a dependency cannot be installed, explain the concrete limitation and complete as much as possible without claiming the game was verified. Do not publish the project or perform external actions unless separately authorized.

## 14. Verification and acceptance criteria

Automate the rules most likely to break: rotated footprints, bounds/overlap rejection, corner adjacency exclusion, shared-edge deduplication, exact recipe predicates, removing a support item removing its bonus, invalid-drop rollback, purchase/sell money invariants, Lunchbox healing exploit prevention, and damage being applied only once per attack/hit policy.

Run type checking and a production build. In a real browser if available, verify movement, timer, targeting, shove, collecting, damage/death, a full shop transaction, rotation, a working combination in combat, pause/resume, boss victory, defeat, and clean restart. Provide a development-only shortcut to jump to boss/shop states, kept out of the production UI. Restart must not duplicate listeners, timers, audio loops, or DOM overlays.

Inspect screenshots at 1,440 × 900 and 1,280 × 720. Check that inventory cards, tooltips, sell targets, and buttons fit and that the game canvas and DOM remain aligned. Test keyboard focus and prevent game hotkeys from firing while interacting with menus. Check Chromium and Safari when tools permit; otherwise state which browser was actually tested. Do not claim browser compatibility or performance based only on a successful compile.

The result is acceptable when:

- A new player can start, understand movement, and survive a first wave without reading a document.
- Cart placement changes actual weapon behavior, not just tooltip labels.
- Toast Mode visibly changes toast attacks and is obtainable early.
- Purchases require real tradeoffs in space and money.
- All eight waves and the boss form a complete run with reliable win/loss states.
- The goblin, shopping cart, angry groceries, and receipt UI share a consistent visual language.
- Combat remains readable with a developed build and a crowded arena.
- There are no missing textures, broken paths, uncaught errors, or fake interactive controls.

Deliver source code, all required local assets, a README with exact setup/build/run commands, `ASSETS.md`, a short explanation of controls and implemented content, and screenshots of actual gameplay and the shop if the environment supports capture. Clearly distinguish completed checks from checks you could not run. The final result should make me want to immediately play another run.

Start implementing now.
