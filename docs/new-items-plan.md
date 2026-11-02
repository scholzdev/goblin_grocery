# New items and mechanics plan

Status: draft. Every number here is a first guess, sized against the current values listed under Reference. Balance them with the sims (`docs/sims.md`) and a playtest before treating them as final.

## Reference values

| What | Value | Source |
|---|---|---|
| Player max HP, speed, i-frames | 40, 250, 0.6 s | `src/data/items.ts:42-47` |
| Dash | 6 dmg, 130 px, 3 s cooldown | `src/data/items.ts:49` |
| Running Boot dash damage | +6 / +9 / +12 | `src/content/items/boot.ts:9` |
| Slam Bumper landing blast | 8 / 12 / 16, radius 90 | `src/content/items/bumper.ts:6` |
| Fuel Can burn | 3 / 5 / 7 dps for 3 s, refreshes | `src/content/items/fuel.ts:8` |
| Oven vent / live cable hit on player | 6 / 5 | `src/data/departments.ts:66-67` |
| Pan ★1 | 9 dmg every 1.12 s | `src/content/items/pan.ts:6` |
| Tier multipliers | dmg x1 / x1.5 / x2, cooldown x1 / x0.9 / x0.8 | `src/engine/define.ts:74-75` |
| Coins in aisle 1 | about 12 from kills + 12 clear bonus | `src/data/waves.ts:63-87` |
| Repair | 6 + 2 x shop coins for 10 HP | `src/systems/shop.ts:16` |

The player takes no damage over time from anything today. Every hit on the player is one-shot and blocked by i-frames (`src/scenes/hazards.ts:133`).

## Shop lock (system, not an item)

One lock button for the whole shop, next to the reroll button. While the lock is on:

- every unsold offer carries over to the next shops, for as long as the lock stays on,
- the offers keep the prices they had when you locked them, so inflation doesn't apply,
- slots you bought from get fresh offers in the next shop, so the shop never runs empty,
- reroll is disabled, and you unlock to reroll again.

Locking is free.

Data: add `locked: boolean` to `ShopState` (`src/types.ts:~252`). When it is on, `openShop` (`src/state/run.ts:280`) keeps the unsold `offers` and fills only the sold slots through `rollOffers` (`src/systems/shop.ts:48`). `reroll` (`src/state/run.ts:240`) refuses. The button goes next to the reroll button in `src/ui/shop.ts:~559`.

## Perishables

Both use the per-instance counter the way Sourdough uses `rise` (`src/state/run.ts:267`).

**Avocado.** Snacks, module, 1x1, base price 8.
- Aisles 1 to 3 in the cart: adjacent weapons get +10% damage per aisle, up to +30%. Sell value goes up by 4 coins per aisle.
- From aisle 4 it is brown: adjacent weapons get -20% damage until you sell it. Brown avocados sell for 1.
- Higher tiers give +12% / +15% per aisle.

**Fresh Fish.** Kitchen, passive, 2x1, base price 12.
- For 2 aisles: all weapons get +15% / +20% / +25% crit chance.
- After that it stinks for good. It poisons enemies like Expired Milk's aura (radius 110), and shop prices go up 20% while it is in the cart.

## Active items ("spells")

These are new cart items with charges that refill at the start of each aisle. They fit the existing grid, the shop and merging (a higher tier adds charges), so they need no separate spell slot.

- **Key.** E (not bound today, `src/state/keymap.ts:9-18`). Add it as a `useActive` action so players can rebind it.
- **Several actives in the cart.** E fires every active item that has a charge left. One key keeps it readable, and owning two becomes a combo moment.
- **Data.** Add `charges` to `ItemInstance` (`src/types.ts:69-85`) and reset it in `startNextWave` (`src/state/run.ts:307`).

**Fire Extinguisher.** Cleaning, frost, 1x2, base price 16.
- 3 / 4 / 5 charges per aisle.
- A cone of 70° and 180 px. Each blast does 6 damage, slows, stuns for 0.6 s and knocks back 200.

**Air Horn.** Checkout, 1x1, base price 14.
- 1 / 1 / 2 charges per aisle.
- Stuns every enemy on screen for 1.0 s / 1.3 s / 1.5 s. Bosses are stunned for 0.3 s only.

### Actives on existing items

Two existing items get an active on top of what they already do. Their passive effect stays the same. Every other item stays passive, so players who never press E lose nothing.

**Bubble Wrap: Pop.** It already reduces each hit by 1 / 2 / 3 and gives 0.25 s of invulnerability after a hit (`src/content/items/bubblewrap.ts:6`). The new active has 1 charge per aisle. It gives 1.5 s of invulnerability and a pop blast of 10 / 15 / 20 damage in an 80 px radius.

**Vacuum: Full Suck.** It already pulls with 70 force and does 2 damage every 0.65 s within 150 px (`src/content/items/vacuum.ts:6`). The new active has 1 charge per aisle. For 2 s the pull is tripled and the range doubles, and every coin on screen flies to you.

Leaf Blower was the third candidate. It stays passive, because its push and wall slam (`src/content/items/leafblower.ts:6`) already do what an active would.

### What needs evaluating Whether players remember to press E in a busy aisle. Whether a 1 s screen stun trivializes elites. Whether firing all actives at once wastes charges. The sims can't measure the first one, so it needs a playtest.

## Items that grow

**Potted Basil.** Kitchen, module, 1x1, base price 10.
- Adjacent weapons get +2% / +3% / +4% damage per 25 kills, with no cap.
- The kill count lives on the item and is lost if you sell it.

**Kombucha Scoby.** Snacks, module, 1x1, base price 12.
- Adjacent hits poison.
- The poison gets 10% stronger every aisle the Scoby stays in the cart. A Toxic Fumes kill counts as an extra aisle, up to once per aisle.

## Cart weight

Weight is the number of occupied cart cells. It only matters through these two items, so carts without them play exactly as they do today.

**Bowling Ball.** Tools, blast, 2x2, base price 18.
- -0.5% move speed for each occupied cell.
- The dash deals +1.0 / +1.5 / +2.0 damage for each occupied cell, and knockback goes up 50%.
- Check. A 7x5 cart with 20 cells filled gives a ★1 dash of 6 + 20 = 26 every 3 s, about 8.7 dps, and it hits every enemy in its path. That's above Pan ★1 at 7.8 dps. Boot plus Bumper at ★1 deals 12 plus an 8-damage blast. The ball pays two cart cells and -10% speed for that. Trim the per-cell value if the sims show dash builds pulling ahead.

**Helium Balloon.** Snacks, passive, 1x1, base price 10.
- +10% / +15% / +20% move speed.
- Items next to the Balloon count as zero cells for the Bowling Ball's slow. They still count for its damage.

## Cursed items

**Ghost Pepper.** Kitchen, heat, passive, 1x1, base price 14.
- +50% / +65% / +80% damage on heat hits and burn.
- When you get hit, you burn for 1.5 dps over 2 s, which is 3 HP extra per hit. Burning again refreshes the timer and doesn't stack.
- Burn ticks don't trigger the hurt reaction or i-frames. They can't take you below 1 HP, so the pepper never gets a kill the enemies didn't earn.
- Why 1.5 dps for 2 s. It works out to half an oven-vent hit (6) on top of every hit you take. That's noticeable at 40 max HP, but it still lets a careful player keep it. If you want it harsher, try 2 dps for 3 s, which is 6 per hit, the same as a vent.
- New code. A player burn timer next to the player HP handling in `src/scenes/ArenaScene.ts:~926`.

**Scratch Ticket.** Checkout, passive, 1x1, base price 8.
- At the start of each aisle: a 1-in-5 chance of 30 coins. Otherwise you lose 10% max HP (4 HP at base).
- Expected value per aisle: +6 coins and -3.2 HP. That's slightly better than buying repairs, so it pays off for players who dodge well.

## Contracts

**Punch Card.** Checkout, passive, 1x1, base price 10.
- Each aisle shows one goal, drawn from a table filtered by the tags in your cart so it can always be done. Examples: 20 heat kills, 5 dash kills, no hit for 20 s, 3 elite kills.
- Completing it gives 1 free reroll and 5 / 8 / 12 coins.
- The free reroll can use the existing `bonusFreeRerolls` on `ShopState`.

HUD for progress during the aisle. Today the HUD is one top-centre strip (`src/ui/hud.ts:20-47`) with HP, aisle, clock, coins and the dash ring.

- **Aisle start.** Put the goal on the sub line of the aisle-start banner (`showBanner`, `src/ui/hud.ts:124`, called at `src/scenes/ArenaScene.ts:186`), so the player reads it before the fight.
- **During the aisle.** Show a small punch-card sticker right under the HUD strip, with the goal text, a counter ("12 / 20 heat kills") and a thin progress bar. For timed goals ("no hit for 20 s"), the bar fills over time and empties when you get hit. Update it from `hud.tick()` (`src/ui/hud.ts:91`).
- **Done.** A hole gets punched in the card with a stamp sound, a `hud.bark("Punched!")` (`src/ui/hud.ts:112`) pops up, and the card goes gold for the rest of the aisle.
- **Failed.** A goal that can no longer be met, like a no-hit timer during the last 20 s, turns the card grey so the player stops chasing it.

## Shortcut

**Shortcut Key.** Tools, passive, 1x1, base price 12. Works once per run.
- How you use it. On the door screen after a shop, a third "Staff Only" door shows up while you own an unused key.
- Going through it skips the next aisle. You get no fight, no clear bonus and no shop, and you heal to full. You go straight into the aisle after it.
- It never shows up when the skipped aisle would be the mid-boss aisle (4) or the boss aisle (8).
- After use the key turns into a spent 1x1 item you can sell for 1.
- Code. Add a `shortcut` route in `chooseDoor` (`src/state/run.ts:329`) that moves `wave` forward by two, plus the door in `rollDoors` (`src/systems/shop.ts:76`). `sim.ts:49` calls `startNextWave` directly, so the sims need to handle the route too.

Why it earns its place. You trade the coins and loot of one aisle for a full heal and a faster run. That gives low-HP runs a way back.

## Goblin abilities (evaluation)

Today the four starters only differ in stats (`src/data/items.ts:53-58`):

| Goblin | Today |
|---|---|
| Toast Goblin | no perk |
| Line Cook | +5 max HP, x0.95 speed |
| Coupon Clipper | -8 max HP, x0.85 prices, +12 starting coins |
| Night Shift | -1 s dash cooldown, x1.08 speed, x0.9 weapon damage |

Recommendation: give each goblin one passive signature that uses the existing hooks. Don't add separate goblin actives, since they would fight the active items over the E key.

- **Toast Goblin.** The first hit of each weapon in each aisle always crits. This works with any starter weapon, since the starter weapon is picked separately (`src/data/items.ts:62`). It gets something today in place of nothing.
- **Line Cook.** Merging two items heals 5 HP.
- **Coupon Clipper.** The first reroll in every shop is free.
- **Night Shift.** Dash kills cut the dash cooldown by 0.5 s.

## New reactions

These go in `src/engine/reactions.ts` next to Shatter, Fumes, Conduct and Crack. They add to that list and replace nothing. No reaction covers Wet plus frost or blast plus poison today.

**Ice Sheet** (Wet enemy takes a frost hit). It eats the Wet like Conduct does. The enemy slides helplessly for 1.5 s, and if it hits a wall, an obstacle or another enemy it takes 12 damage. The wall slam can reuse the Leaf Blower's slam code (`src/content/items/leafblower.ts:12`).

Overlap to settle when it's built. Wet plus frost already has two effects that aren't reactions. One is `wetFreezeChance` (`src/engine/wet.ts:22`), which doubles the freeze chance on Wet enemies. The other is the Black Ice combo (Mop plus Ice Pack, `src/content/combos/blackIce.ts:22`), which freezes enemies for 0.8 s when they step into a puddle. Freezing comes first, since a frozen enemy can't slide. Ice Sheet triggers only if the hit didn't freeze. That keeps Black Ice as it is.

**Snow Cone Machine.** Kitchen, frost, puddle, 2x1, base price 16. Drops frost puddles that make enemies Wet and slow them, so it sets up Ice Sheet on its own.

**Detonate** (poisoned enemy takes a blast hit). It eats the poison and turns what's left into burst damage, equal to the poison dps times the seconds remaining, in a 70 px radius. This is a different kind of reaction from Fumes, which spreads poison as a cloud. Detonate spends poison for damage right away.

**Moldy Bread.** Snacks, blast, module, 1x1, base price 12. Explosions from adjacent weapons leave a spore cloud (radius 70, 3 s) that poisons. The next blast hit on a poisoned enemy then detonates it, so the item sets up its own reaction.

## Better selling

**Barter Stamp.** Checkout, passive, 1x1, base price 10. All sells pay 65% / 75% / 85% instead of 50%.

**Collector's Binder.** Checkout, passive, 1x2, base price 14.
- When you buy it, it picks the family you have the most items of.
- Items of that family sell at full price.
- Each one you sell gives +2% damage to that family, up to +20%.

## Cut

Rain Check, Layaway Tag, Shopping List, Aisle Sign, Receipt Printer, Store Map, Fragile Delivery, Customer Bell, Shoplifter Alarm, Bait Coupon, Night Shift Badge, Overtime Clipboard. Achievements, touch controls and the web build are skipped for now.
