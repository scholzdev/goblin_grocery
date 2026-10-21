# About a visual overhaul, October 2026

Status: draft, 2026-10-20. This reviews the current look and recommends a direction for an overhaul. The captures named here are in `screenshots/audit-2026-10-20/` (gitignored), taken at 1280x800 unless the name says otherwise. See [README.md](README.md) for how to reproduce them.

## Keep the art style

The generator (`tools/gen-assets.mjs`) gives every sprite one style. Shapes look like cut paper, with flat fills, one shade tone, plum `#30203F` outlines, and light from the upper left. Enemies, items, props, goblin skins and UI stickers share the outline weight and the palette. Nothing looks pasted in from another style. That consistency is the main asset to keep, and it is why the recommendation below works inside the generator.

Several things already work well:

- The goblin and cart silhouette is unique and always readable.
- Gold coins are distinct from everything else.
- Damage numbers come from a pool of 14 (`src/scenes/fx.ts:7`) with a per-enemy throttle, so they never flood the screen.
- The title screen and the end receipts have the clearest hierarchy in the game (`title.png`, `end-victory.png`, `end-defeat.png`).
- The normal departments read as distinct places.

## The problem is value and depth, not hue

In a crowd the eye cannot separate what matters from scenery. Floors are pale. Props, enemies and pickups all sit at mid to high saturation with the same plum outline. Nothing in the style marks one thing as more important. The Electronics department is the exception, because its dark floor makes every actor stand out.

The 70-enemy stress capture (`chaos-stress-clean.png`) shows five problems.

1. **Enemy fire is hard to see.** The spitter's `proj_bubble` is a pale blue-white circle on a pale mint floor. Enemy shots also depth-sort with the world (`DEPTH.world + s.y`, `src/scenes/weapons.ts:106`), so any enemy, shelf or prop in front hides them. Player shots are warm or neutral, so neither side owns a color.
2. **The soda enemy looks like a prop.** The six-pack enemy and `prop_cans` share the motif, the palette and the size. In the stress capture the six-packs blend into the can pyramids. The player has to look for faces to tell a threat from scenery.
3. **Attack warnings draw under everything.** Telegraphs use `DEPTH.telegraph = 4` (`src/data/depth.ts:2`, `src/scenes/ArenaScene.ts:175`), below every actor and prop. Baguette charge rectangles are half covered by the crowd. They are thin, low-alpha coral outlines on a cream floor.
4. **HP bars add noise.** Every enemy with `hpBar` shows a red bar. At 70 enemies the bars form a red layer that competes with the coral telegraphs and the red soda enemies.
5. **The hit flash fails on pale enemies.** `setTintFill(0xffffff)` (`src/scenes/ArenaScene.ts:738`) barely changes milk, egg and sanitizer, which are already near white.

## The shop draws the eye to empty space

In `shop-wave3.png` the empty cart cells are saturated teal, and placed items are pale cream or mint cards. The empty staging shelf is a heavy lavender block. The eye goes to the empty space, not to the build. On 1x1 items, the name covers most of the icon. Luckiest Guy is used at 12px for cart tags and for button captions such as "CART MAX", where it is hard to read. The 1x1 footprint preview under an offer's name is a tiny black square that reads as a glitch. At 2560x1080 (`aspect-2560-shop.png`) a wide empty band separates the cart from the deals.

Two shop bugs belong to this area: the clipped double-pack chip and the German names that overflow their cell ([bugs.md](bugs.md), bugs 11 and 12).

## The boss fight loses the department theme

All five bosses fight in the same cream checkout-lane room (`boss-frozen-live.png`, `boss-electronics-live.png`, `boss-checkout.png`), because `src/state/run.ts:436` sets the department to `boss` on the last aisle. The run's climax is its least themed room. The same line causes two text bugs. The HUD reads "MANAGER" for every boss, and the victory receipt always names the Store Manager ([bugs.md](bugs.md), bugs 48 and 49).

## Three directions

| | A. Readability pass | B. Flyer style in the generator | C. Hand-made art |
|---|---|---|---|
| Look | The same cut-paper style, with a value hierarchy | Halftone patterns, thicker actor outlines, department color ramps, more animation frames | Painted or pixel art in atlases |
| Fixes the five combat problems | All five | All five, later | Only with A's work as well |
| Cost | M | L | L to XL, plus an artist |
| Risk | Low | Medium | High |
| Generator | Kept. Value tiers become named constants in its `C` table. | Kept and extended with a style layer | Replaced for sprites |
| First visible gain | After step 1 | After weeks | After months |

Direction B regenerates every sprite, so it can break the consistency that is the current strength, and it is easy to spend weeks on look before readability improves. Direction C loses deterministic regeneration, crisp scaling at 2560 wide, and the "all art is generated" licensing line in `ASSETS.md`. New items would wait on an artist. Neither B nor C fixes value hierarchy or depth order by itself.

## Recommendation: direction A

Every problem found is a hierarchy problem, meaning value, color ownership, depth order or CSS weight. The generator and the depth table already control all of those. Direction A fixes them inside the pipeline at medium cost and low risk. B can follow later as targeted upgrades, such as hit and death frames for enemies, once A has set the value rules that B would have to respect.

## Phased plan for direction A

Each step ends in a capture that shows the change. The steps run in order of readability gain.

1. **Give hostile fire one color and draw it above the crowd.** Recolor the enemy variants of `proj_bubble` and `proj_receipt` in `tools/gen-assets.mjs` to a danger hue (a hot coral or magenta core, plum outline, white rim). Add `DEPTH.enemyShot` between `world` and `fx`, and use it at `src/scenes/weapons.ts:106`. Keep the shadow on `decal`. Pass when every enemy shot in the stress capture is visible and reads as hostile.
2. **Push props back and pull actors forward.** Give props and floor decor a muted tier in the generator's `C` table, with lower saturation and a lighter 2px outline. Repaint `prop_cans` away from the soda enemy, or change the motif to boxes. Pass when the six-packs separate from the pyramids at a glance.
3. **Make warnings and hits readable.** Draw telegraphs above props, or draw them twice (a floor fill plus a thin outline above the actors), with a pulse. Flash pale enemies coral or plum instead of white, and add a small squash on hit. Show HP bars only after the first hit, and always on elites.
4. **Give each boss its own department room.** Build the boss room from the theme's floor, walls and props, with checkout lanes as an accent only. Fix the HUD subtitle and the victory text in the same change. Ask first whether the boss room should inherit the theme's hazard, because `department = 'boss'` also selects the music and the hazards.
5. **Fix the shop hierarchy and the type.** Make empty cells low-contrast and let placed items carry the color. Show names on 1x1 items only on hover, with hyphenation for German. Wrap the double-pack chip. Set a 16px floor for Luckiest Guy and use Nunito 800 below that. Cap the layout width so a 2560-wide screen groups the cart with the deals.
6. **Sweep for consistency.** Regenerate the sprites and review the contact sheet with `node tools/gen-assets.mjs && node tools/snap-contact.mjs`. Rerun every capture at 1024x768, 1280x800 and 2560x1080.

Commands for each step's capture:

```bash
BOOT=7000 npm run shot -- wave3 step1.png 2500 "document.getElementById('simnote')?.classList.add('hidden'); __arena.devStress(70,150)"
```

```bash
BOOT=7000 npm run shot -- boss-checkout step3.png 4000 "document.getElementById('simnote')?.classList.add('hidden')"
```

```bash
BOOT=7000 npm run shot -- boss-frozen step4.png 3500
```

```bash
BOOT=7000 npm run shot -- wave3 step5.png 3000 "__gg.flow.endWave()"
```

```bash
BOOT=7000 LOCALE=de npm run shot -- wave3 step5-de.png 3000 "__gg.flow.endWave()"
```

Motion was judged from code only, because still captures cannot show it. Camera shake, hit flash, a slow-motion beat on big moments, and six particle types exist. Squash and stretch on enemy hits and deaths, and hit-stop on single big hits, do not.
