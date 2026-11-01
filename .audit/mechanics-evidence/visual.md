# Visual audit and overhaul draft

Area: `visual`. Read-only. Every fresh capture was made with `npm run shot` (tools/verify-shot.mjs) at 1280x800 unless the name says otherwise. They are in `scratchpad/shots/`. Shots from `screenshots/` are older captures dated 2026-10-14 by file mtime (they are untracked, so git has no date). They are labelled as old wherever this report uses them.

Shots directory: `/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/shots/`

| Shot | What it shows |
|---|---|
| `combat-wave3.png` | Real aisle 3, main dept, early wave |
| `chaos-stress.png`, `chaos-stress-clean.png` | Aisle 3 plus `devStress(70,150)`: 70 enemies, full chaos (clean = sim note hidden) |
| `boss-checkout.png` | Live Self-Checkout Kiosk, fire hazards |
| `boss-frozen-live.png`, `boss-electronics-live.png` | Live Walk-In Freezer and Smart-TV Wall, both in the same room |
| `boss-bakery.png`, `shop-rich.png` | Boss intro and "defeated" banners (shop-rich is misnamed, it shows the Store Manager intro) |
| `shop-wave3.png`, `shop-hover-offer.png`, `shop-de.png` | Shop (cart loadout) idle, with the offer inspector open, in German |
| `aspect-1024-combat.png`, `aspect-1024-shop.png`, `aspect-2560-shop.png` | Aspect ratios |
| `title.png`, `end-victory.png`, `end-defeat.png`, `boss-frozen.png` | Title, victory receipt, defeat receipt, victory after the frozen boss |

How to reproduce a shot (BOOT matters: with the default `BOOT=1500` a cold dev server is not up when the js runs and it fails with `__arena is not defined`):

```
BOOT=7000 npm run shot -- wave3 out.png 2500 "document.getElementById('simnote')?.classList.add('hidden'); __arena.devStress(70,150)"
BOOT=7000 npm run shot -- wave3 out.png 3000 "__gg.flow.endWave()"                      # shop
BOOT=7000 LOCALE=de npm run shot -- wave3 out.png 3000 "__gg.flow.endWave()"            # German shop
BOOT=7000 npm run shot -- boss-frozen out.png 3500                                       # live themed boss
BOOT=7000 npm run shot -- wave3 out.png 3000 "__gg.flow.toTitle()"                       # title
BOOT=7000 npm run shot -- wave3 out.png 3000 "__gg.flow.defeat()"                        # end screen
```

## Bugs

### 1. Double-pack chip is clipped in the item inspector, hiding the price penalty
- Severity: medium. Label: **confirmed** (reproduced, `shop-hover-offer.png`).
- `src/ui/style.css:781`
  ```css
  .inspector .chip { white-space: nowrap; ... flex: 1; ... }
  ```
  The chip is built at `src/ui/shop.ts:383`:
  ```ts
  const dblNote = offerDouble || (loc?.inst.double ?? false) ? `<span class="chip dbl">${esc(t('setDouble', { set: tagT(def.family) }))}</span>` : '';
  ```
  The English string is `'Double pack: counts as 2 items for the {set} set (costs 1.5×)'` (`src/i18n/ui.ts:465`).
- Scenario: in the shop, hover an offer with the 2-PACK sticker (seed 1, aisle 3, the Running Boot). The inspector shows "Double pack: counts as 2 items for the Tools set (cost" and cuts off at the card edge. The part the player loses is "costs 1.5×", which is the reason the offer costs more. In German the string is longer, so more of it is lost.
- Fix: let `.chip.dbl` wrap (`white-space: normal; flex-basis: 100%`), or render it as its own full-width line under the chips.

### 2. German item names in the cart overflow their cell and the cart frame
- Severity: medium. Label: **confirmed** (reproduced, `shop-de.png`).
- `src/ui/style.css:329`
  ```css
  .item .tag { left: 4px; right: 4px; max-width: none; width: fit-content; margin: 0 auto; text-align: center; padding: 1px 4px; line-height: 1.05; } /* narrow cells wrap the name onto two lines instead of cutting it */
  ```
- Scenario: `LOCALE=de`, open the shop with the wave3 cart. "Einkaufsklingel" (Shopping Bell, 1x1) runs past the right edge of the cart frame. "Tischventilator" shows as "TISCHVEN", "Rennstiefel" as "RENNSTIE", and "Benzinkanister" spills over the next cell. The comment says names wrap, but a single German compound has no break opportunity, so it overflows instead.
- Fix: add `overflow-wrap: anywhere; hyphens: auto;` to `.item .tag` and make sure `<html lang>` follows the locale so the browser can hyphenate German. A stronger fix is in phase 5 below: hide names on 1x1 items and show them on hover.

### 3. Victory receipt always says the Store Manager was beaten
- Severity: low (wrong player-facing text on four of the five bosses). Label: **confirmed** (traced, and reproduced in `boss-frozen.png`: Walk-In Freezer killed, receipt says "The Store Manager has been returned to the shelf.").
- `src/ui/ui.ts:551`
  ```ts
  <div style="text-align:center;font-weight:800">${won ? t('managerReturned') : t('cartStopped', ...)}</div>
  ```
  The boss is `bossFor(s.theme)` (`src/scenes/ArenaScene.ts:471`), so a frozen, bakery, electronics or checkout run faces a themed boss in a real run, not only in the lab. Both `managerReturned` strings (EN `src/i18n/ui.ts:167`, DE `:828`) hard-code the manager.
- Fix: a `bossReturned` string with `{name}` filled from `enemyT(bossFor(s.theme)).name`.

### 4. HUD subtitle reads "MANAGER" in every boss fight, whoever the boss is
- Severity: low. Label: **confirmed** (traced the real-run path; visible in `boss-frozen-live.png` and `boss-electronics-live.png`).
- `src/state/run.ts:436` sets `state.department = boss ? 'boss' : ...` (and `:451` does the same on the door path). `src/ui/hud.ts:86` then prints `deptT(s.department).short`, which is "MANAGER" / "FILIALLEITER" for `boss`.
- Scenario: a frozen-theme run reaches aisle 8. The HUD reads "FINAL AISLE · MANAGER" while the boss bar reads "THE WALK-IN FREEZER".
- Fix: on the boss aisle, print the boss's short name (or the theme's name) in the subtitle. Phase 4 below fixes this together with the room art.

### 5. Dev only: the sim note draws under the 2-PACK sticker
- Severity: low (dev tool only). Label: confirmed (`shop-wave3.png`). `#simnote` is `z-index: 3` (`src/ui/style.css:967`), and the offer card's `.dblpack` sticker draws over its text for the 12 s it is shown. Raise `#simnote` above the shop.

No layout breaks found at 1024x768 (`aspect-1024-*.png`). The UI scales down cleanly there.

## Audit of the current look

### Art style consistency: strong
The generator gives one coherent style: cut-paper shapes, flat fills with one shade tone, plum `#30203F` outlines, light from the upper left (`ASSETS.md`, `public/assets/svg/contact-sheet.html`, old `screenshots/contact-sheet.png`). Enemies, items, props, goblin skins and UI stickers all share the outline weight and palette. Nothing looks pasted in from another style. This is the main asset to keep.

### Palette and contrast: the weak point is value, not hue
Floors are pale (mint main, cream checkout/boss, peach bakery). Props, enemies and pickups are all mid-to-high saturation with the same plum outline. Nothing in the style says "this thing matters more". Props and actors sit in the same value band, so at density the eye cannot separate them. Electronics is the exception: its dark teal floor makes every actor pop (old `screenshots/dept-electronics.png`).

### Combat readability at full chaos (`chaos-stress-clean.png`)
1. **Enemy fire has no danger colour and sorts with the world.** The spitter's `proj_bubble` is a pale blue-white circle on a pale mint floor. Enemy shots get `DEPTH.world + s.y` (`src/scenes/weapons.ts:106`), so a shot that passes behind an enemy, a shelf or a can pyramid is hidden. Inferred from code plus the shot: in `chaos-stress-clean.png` the bubbles near the player are visible only because they are in open floor. Player shots (toast, nails, caps) are also warm or neutral, so neither side owns a colour.
2. **The soda enemy reads as a prop.** The soda six-pack enemy (red cans with faces) and `prop_cans` (a red/teal/yellow can pyramid) share motif, palette and size. In `chaos-stress-clean.png` the six-packs merge into the pyramids at left and right. A player has to look for faces to tell a hazard from scenery.
3. **Telegraphs sit under everything.** `this.telegraphs` uses `DEPTH.telegraph = 4` (`src/scenes/ArenaScene.ts:175`, `src/data/depth.ts:2`), below every actor and prop (`world = 10 + y`). In the chaos shot the baguette charge rectangles are half covered by the crowd. Thin, low-alpha coral outlines on a cream floor are also weak.
4. **HP bars add noise.** Every enemy type with `hpBar` (`src/data/enemies.ts:145`) shows a red bar. At 70 enemies the bars form a red confetti layer that competes with the coral telegraphs and the red soda enemies.
5. **Damage numbers are fine.** A pool of 14 (`src/scenes/fx.ts:7`), a per-enemy throttle (`ArenaScene.ts:744`), crits bold with a halo. They stay legible and never flood. Keep this.
6. **The player reads well.** The green goblin plus the cart silhouette is unique and always visible. Pickups (gold coins) are distinct.

### UI hierarchy (shop and HUD)
- **Shop hierarchy is inverted** (`shop-wave3.png`). Empty cart cells are saturated teal, while placed items are pale cream or mint cards. The empty staging shelf is a heavy lavender block. The eye goes to the empty space, not to the build. Item names in 1x1 cells cover most of the icon (Hot Sauce, Running Boot, Shopping Bell).
- **Offer cards are clear** (art, name, price pill, set icons, combine tag). The tiny black square under each name is the footprint preview for a 1x1 item. It reads as a glitch at that size.
- **Ultrawide shop** (`aspect-2560-shop.png`): the cart sits in the middle with a wide empty band between it and the deals column. Not a bug, but the layout spreads instead of grouping.
- **HUD** is compact and on brand (receipt strip, Luckiest Guy numbers). The boss attack call (`#bark`, `style.css:129`) appears at the bottom above the boss bar, far from where the player is looking.
- **Title and end receipts** (`title.png`, `end-victory.png`, `end-defeat.png`) are the strongest screens: the receipt metaphor, clear hierarchy, readable stats.

### Typography
Luckiest Guy for display and Nunito for body is a good pair. Luckiest Guy gets used too small: cart item tags at 12px (`style.css:226`) and button captions like "CART MAX" / "+1 SHELF" are hard to read and are all caps with no lowercase. Rule of thumb for a fix: display face at 16px or more, Nunito 800 below that.

### Motion and juice (from code; static shots cannot show motion)
Present: camera shake on hits, boss landings and dashes, gated by settings and reduced motion (`fx.ts:140`). Hit flash with `setTintFill(0xffffff)` for 0.06 s and a re-trigger gap (`ArenaScene.ts:734-738`). A tween slow-mo on a big moment (`ArenaScene.ts:1400`). Particles: spark, crumbs, puff, flame, confetti, frost. Pop-in damage numbers.
Gaps: the white hit flash barely changes pale enemies (milk, egg, sanitizer are already near white; visible in `combat-wave3.png`, where the hit milk is a white silhouette on a pale floor). There is no squash-and-stretch on enemy hit or death beyond the shared particle puff, and there is no hit-stop on single big hits.

### Departments as distinct places
Normal aisles read as distinct places. Main has purple shelves and freezers, frozen has ice patches and an ice-cream cart, bakery has warm wood racks and ovens, electronics has a dark floor, TV walls and cables (`title.png`, old `dept-bakery.png`, old `dept-electronics.png`). The **boss aisle drops this**. Every boss fights in the same cream checkout-lane room (`boss-frozen-live.png`, `boss-electronics-live.png`, `boss-checkout.png`), because the department is forced to `boss` (`run.ts:436`). The run's climax is the least themed room in it.

## Overhaul directions

### A. Readability pass inside the current generated style (recommended)
Look: the same cut-paper style, but with a value hierarchy. Floors and props are pushed back (lower saturation, lighter outlines). Actors get full saturation and the heavy plum outline. Hostile things own one hue (hot coral/magenta with a white rim) and draw above the crowd. The shop fills the build and quiets the empty space.
Fixes: enemy fire visibility, the soda/prop confusion, buried telegraphs, inverted shop hierarchy, the boss room losing its theme, small type.
Cost: M. Files: `tools/gen-assets.mjs` (proj_*, prop_cans, prop and floor palettes), `src/data/depth.ts`, `src/scenes/weapons.ts`, `src/scenes/ArenaScene.ts` (telegraph depth and style, boss room), `src/scenes/enemies.ts` (hit flash), `src/scenes/fx.ts`, `src/ui/style.css`, `src/ui/shop.ts`, `src/ui/hud.ts`, `src/state/run.ts` (boss department), a DEPARTMENTS entry per boss room.
Risk: low. Every step is local and screenshot-verifiable. The main risk is golden snapshots or tests that pin depth constants or department ids; grep before changing `department = 'boss'`.
Pipeline: kept. Palette and outline tiers become named constants in the generator's `C` table, so the hierarchy is encoded once and every sprite regenerates from it.

### B. A stronger stylized look, still produced by the generator
Look: a "supermarket flyer" style. Halftone shading patterns as SVG `<pattern>` (the style guide currently forbids filters, but patterns are allowed), thicker actor outlines, per-department colour ramps and a lighting overlay (vignette plus department tint), more animation frames per enemy (squash on hit, separate death frame), price-tag and sticker motifs on telegraphs.
Fixes: everything A fixes, plus a more distinctive identity for a trailer or store page.
Cost: L. Touches most of the 2567-line `tools/gen-assets.mjs` (every drawing function), `src/data/assets.ts` (new frame keys), the animation code in `src/scenes/enemies.ts`, and the contact-sheet review.
Risk: medium. It regenerates every sprite, so it can break the consistency that is the current strength. More frames cost texture memory and load time. It is easy to spend weeks on look before the readability problems are fixed.
Pipeline: kept and extended (a style layer with patterns, ramps and frame variants).

### C. Hand-made or external art
Look: painted or pixel art from an artist or a raster tool, packed into atlases.
Fixes: could reach a higher craft ceiling for characters and bosses.
Cost: L to XL, plus outside money or time. Every sprite key in `src/data/assets.ts`, the loader in `BootScene.ts`, the item icons the HTML UI uses, and the shop and catalog CSS that assume SVG scaling.
Risk: high. It loses deterministic regeneration (`node tools/gen-assets.mjs`), it loses crisp scaling at 2560 wide, it adds licence tracking (`ASSETS.md` currently states all art is original and generated), and new items would wait on an artist. It does not fix readability by itself: value hierarchy and depth order are still needed.
Pipeline: replaced for sprites. The generator would survive only for UI icons and FX.

| | A. Readability pass | B. Flyer style in generator | C. Hand-made art |
|---|---|---|---|
| Main win | Fights and shop read at full chaos | Distinct identity | Craft ceiling |
| Fixes top 5 problems | All five | All five, later | Only with A's work too |
| Cost | M | L | L to XL plus external |
| Risk | Low | Medium | High |
| Pipeline | Kept, tiers encoded in `C` | Kept, extended | Replaced for sprites |
| Time to first visible gain | One step (enemy fire) | Weeks | Months |

**Recommendation: A.** The problems found are hierarchy problems (value, hue ownership, depth order, CSS weight), and the generator already controls all of those. B can follow later as targeted upgrades, such as hit and death frames for enemies, once A has set the value rules B would have to respect.

## Phased plan for direction A

Each step ends with a command that produces a before/after shot. The first steps carry the highest readability gain.

1. **Hostile fire owns a colour and draws above the crowd.** Recolour the enemy variants of `proj_bubble` and `proj_receipt` in `gen-assets.mjs` to a danger hue (hot coral or magenta core, plum outline, white rim). Add `DEPTH.enemyShot` between `world` and `fx` and use it at `weapons.ts:106` (keep the shadow on `decal`). Player shots keep their warm or neutral colours.
   Shot: `BOOT=7000 npm run shot -- wave3 s1.png 2500 "document.getElementById('simnote')?.classList.add('hidden'); __arena.devStress(70,150)"`. Pass when every enemy shot is visible and identifiable as hostile in the chaos frame.
2. **Push props back, pull actors forward.** Give props and floor decor a muted tier in the generator's `C` table (lower saturation, 2px outline in a lighter plum). Repaint `prop_cans` away from the soda enemy (muted labels, or swap the motif for boxes). Leave actors on the full tier.
   Shot: the same chaos command. Pass when the soda six-packs separate from the pyramids at a glance.
3. **Telegraphs and hits read.** Move telegraph graphics above props and under actors, or draw them twice (a floor fill plus a thin top outline above actors), with a pulse. For pale enemies, flash coral or plum instead of white (`ArenaScene.ts:738`) and add a small scale squash on hit. Show HP bars only after an enemy is first hit, and always on elites.
   Shot: `BOOT=7000 npm run shot -- boss-checkout s3.png 4000 "document.getElementById('simnote')?.classList.add('hidden')"` and the chaos command.
4. **Each boss fights in its department.** Build the boss room from the theme's floor, walls and props plus the boss decor (checkout lanes as an accent, not the whole room). Fix the HUD subtitle (bug 4) and the victory text (bug 3) in the same change.
   Shot: `BOOT=7000 npm run shot -- boss-frozen s4.png 3500` and `boss-electronics`, then `boss-frozen s4-win.png 14000` for the receipt.
5. **Shop hierarchy and type.** Make empty cells low-contrast (pale outline on the panel colour) and placed items carry the colour. Show names on hover only for 1x1 items, with hyphenation for German (bug 2). Wrap the double-pack chip (bug 1). Set a 16px floor for Luckiest Guy and a max-width layout so 2560-wide groups the cart with the deals.
   Shots: `BOOT=7000 npm run shot -- wave3 s5.png 3000 "__gg.flow.endWave()"`, the same with `LOCALE=de`, and with `VIEW=2560x1080`.
6. **Consistency sweep.** Regenerate and review the contact sheet with `node tools/gen-assets.mjs && node tools/snap-contact.mjs`, check the zoom sheet at 50%, and rerun the full shot set above at 1024x768, 1280x800 and 2560x1080.

## Out of scope leads
- None beyond the bugs above. The boss department (`run.ts:436`) also feeds music (`music_boss`) and hazards, so phase 4 needs a mechanics owner to confirm whether the boss room should inherit the theme's hazard.
