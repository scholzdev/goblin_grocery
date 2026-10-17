
## Audio

All sounds are original, synthesized procedurally by `tools/gen-audio.mjs` (plain Node ESM, zero dependencies, seeded PRNG so output is deterministic). No samples or third-party audio are used. License: same as the project. Regenerate with `node tools/gen-audio.mjs` (writes `public/assets/audio/<key>.wav`, 16-bit mono PCM, 22050 Hz).

- `toast_pop`: toaster thunk + upward blip + small spring boing
- `pan_clang`: cartoony FM metallic clang, quick decay
- `nail_burst`: three rapid pneumatic "tchk" bursts
- `vacuum_pulse`: downward-sweeping noise suck over a low hum
- `coin`: bright two-note plink (B5 to E6)
- `ding`: checkout-register bell
- `click`: tiny UI tick
- `hurt`: goblin "oof", gritty descending blip
- `enemy_death`: squishy splat + downward bloop
- `shove`: cart rattle + whoosh
- `spawn`: soft warning blip pair
- `boss_hit`: heavy thud with metallic tick
- `victory`: cheerful major arpeggio jingle ending on a register ding
- `defeat`: descending sad-trombone three-note phrase
- `wheel_loop`: quiet seamless cart-wheel rattle/squeak loop (exactly 1.0 s, periodic)
- `frost`: icy shimmer and crackle
- `swipe_tell`: rising wind-up swish (attack telegraph)
- `bubble`: soft blub
- `buy`: cash-register "ka-ching"
- `sell`: reverse-swell into a light coin plink
- Music, one original procedural loop per department (`tools/gen-audio.mjs`, seamless, 28-34 s, all loudness-matched to -24 dBFS RMS; `node tools/check-music.mjs` verifies). Played by `src/audio/music.ts` with a 0.8 s crossfade; title and shop use `music_main`, the boss aisle uses `music_boss`:
  - `music_main` 112 BPM cheerful supermarket groove; `music_frozen` 96 BPM glassy celesta arps and airy pad; `music_bakery` 118 BPM swung oom-pah with reedy lead; `music_electronics` 124 BPM synthwave saw arps with sidechain pump; `music_checkout` 132 BPM scanner-beep melody; `music_clearance` 100 BPM jazz lounge with walking bass; `music_boss` 140 BPM E-phrygian bass ostinato and stabs

## Visual assets

All SVGs in `public/assets/svg/` are hand-authored programmatically by `tools/gen-assets.mjs` (plain Node ESM, no dependencies): shared palette/outline constants plus template-literal drawing helpers, one function per asset key. No image generation tool was used (the fal image MCP was unavailable). The art is original work; license is the same as the project. `reference/concept.png` is art direction only and is not used or traced in any asset.

- Regenerate: `node tools/gen-assets.mjs` (writes `public/assets/svg/<key>.svg` for every key in `SVG_ASSETS` in `src/data/assets.ts`, plus `contact-sheet.html`). The key/size list is duplicated inside the script; keep the two in sync.
- Review: `node tools/snap-contact.mjs` renders `contact-sheet.html` with system Chrome (Playwright `channel: 'chrome'`) to `screenshots/contact-sheet.png`, and a readability sheet (`#zoom`: enemies/boss/shelves at 50%, icons at 64px) to `screenshots/contact-sheet-zoom.png`.
- Style: angular cut-paper shapes, flat fills with one shadow tone per material (lower-right), plum `#30203F` edges (3px at listed size, 5px on 192px icons, 1.5-2px on tiny details), light from the upper left. No `<text>`, no filters, no external references; background transparent except `floor_tile`.
- Notes: `fx_sweep` is drawn as a "C" (horns pointing right, bulge on the left) spanning ~150 degrees around the canvas center; rotate in game as needed.
- `zap`: buzzy electric crackle then a bright microwave ding
- `blender`: soft short whirring blade grind (rising pitch, tremolo)
- `cap_ping`: metallic bottle-cap ricochet ping with slight pitch drop
- `splash`: wet mop slap / puddle splash with bubbly blips
- `crit`: price-gun clack into a quick two-tone bell
- `upgrade`: rising 3-note arpeggio with sparkle and a register ding

### Extra items and weapon FX

`tools/gen-assets.mjs` now parses `ICON_IDS` and `SVG_ASSETS` from `src/data/assets.ts`, so keys and sizes cannot drift. Added: `icon_microwave`, `icon_blender`, `icon_fizz`, `icon_mop`, `icon_pricegun`, `icon_tape`, `icon_coupon`, `icon_bubblewrap`, `icon_energy`, `proj_cap`, `fx_zap`, `fx_zap_burst`, `fx_puddle`, `fx_puddle_fire`, `fx_blades`, `fx_crit`, `tier_star`. Same rules as above (no text, no filters, transparent background).

### Legendary items and extra FX

Added: `icon_powerstrip`, `icon_goldstar`, `icon_laser`, `icon_snackbag` (legendary icons: same outline weight and 3/4 view, plus a flat gold rim-light strip, tiny sparkle shapes, no frame/glow), `fx_laser` (256x40, left-middle anchor, fading beam with barcode ticks) and `loyalty_card` (96x64). `icon_pricegun`, `icon_mop` and `icon_fizz` were redrawn for readability.

### Departments

Floors `floor_frozen`, `floor_bakery`, `floor_electronics`, `floor_checkout` (128x128, low contrast, seamless); wall units `freezer_c`, `bakery_rack_a/b`, `oven_wall`, `tv_wall_a/b`, `checkout_counter`; side units `side_freezer`, `side_bakery`, `side_electronics`, `side_checkout`; hazards `hz_ice`, `hz_vent`, `hz_vent_hot`, `hz_cable` (tiles horizontally), `hz_conveyor` (tiles horizontally, chevrons point right); props `prop_icecream`, `prop_breadbasket`, `prop_tvbox`, `prop_lanesign`, `bread_crumb`; door badges `dept_main`, `dept_frozen`, `dept_bakery`, `dept_electronics`, `dept_checkout`, `dept_boss`. `node tools/snap-tiles.mjs` renders `screenshots/tiling.png` (floors and conveyor in a repeated grid, cable in a row) as a seamlessness check.
- `boom`: soft-edged cartoon explosion (pitch-dropping thump, noise sweep, debris)
- `spray`: soft "pssht" spray-bottle burst
- `pop`: party popper pop with confetti shimmer
- `whistle`: pressure-cooker rise-and-fall whistle with slight breathiness

### AOE and multi-hit items

Icons `icon_cooker`, `icon_spray`, `icon_popper`, `icon_doublebag`, `icon_multipack` and FX `proj_pot`, `fx_boom` (flattened 3/4 floor explosion), `fx_spray` (mist cone opening right from x=0, fading with distance, fill-opacity only), `fx_confetti`, `fx_echo` (double impact arcs).

### Skins

Recolors of the goblin and cart layers, keyed `<baseKey>__<skin>` with the same size and anchor as the base: goblin skins `night`, `frost`, `gold` (all 7 parts each) and cart skins `coral`, `gold` (`cart_back`, `cart_front`, `cart_wheel`). The generator swaps a skin palette object (`K`) that the existing drawing functions read, then appends a few skin-only details (frost scarf and speckles, gold highlight band and star badge, coral price tag, gold sparkle cuts). Silhouettes are identical to the base art. `node tools/snap-skins.mjs [scale] [name]` renders assembled goblin plus cart for each skin to `screenshots/skins.png`.
