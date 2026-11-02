# Combo draft: 60 → 100

Status: draft. Rows marked ✅ are implemented (#1–8). Every part listed exists today; every hook exists in `HookEvents` (src/engine/hooks.ts).

Goals:
- Even out the weapons. Laser and Leaf Blower have 2 combos each, Mop and Fizz have 6. After this draft every weapon has 6–7.
- Give 26 of the 33 combo-less items a first combo.
- Cover five categories per weapon where it makes sense.

Categories: **DMG** damage · **CTRL** status/crowd control · **DEF** defense/sustain · **ECO** coins/shop · **MOB** dash/movement.

## Weapon combos (34)

| # | id | Name | Parts | Cat | Effect | Hook |
|---|---|---|---|---|---|---|
| 1 | barcodeFlag | Sale Scan | laser W, flag P | CTRL | ✅ Beam hits apply the Sale Flag mark (normally dash-only). | pattern:beam |
| 2 | thermalScan | Thermal Scanner | laser W, fuel M | DMG | ✅ Beam leaves 3 burning pools along its line for 2s. | pattern:beam |
| 3 | coldChain | Cold Chain | laser W, ice M | CTRL | ✅ Same enemy beamed 3 times in a row freezes (0.8s). | pattern:beam |
| 4 | priceDrop | Price Drop | laser W, coupon P | ECO | ✅ Beam kills get an extra coin roll at 2× the Coupon Book chance. | onKill |
| 5 | leafPile | Leaf Pile | leafblower W, fuel M | DMG | ✅ Strongest burn among hit enemies spreads to everyone within 80 of a burning one. | pattern:cone |
| 6 | snowBlower | Snow Blower | leafblower W, snowcone W | CTRL | ✅ Each blast drops a snow cone slush puddle at the cone end (no drift). | pattern:cone |
| 7 | airRaid | Air Raid | leafblower W, airhorn P | CTRL | ✅ Every 5th blast stuns everything it hits for 0.5s (no E-press part). | pattern:cone |
| 8 | sporeStorm | Spore Storm | leafblower W, moldybread M | CTRL | ✅ Cone end counts as an explosion for Moldy Bread: spore cloud. | pattern:cone |
| 9 | dustDevil | Dust Devil | vacuum W, fan M | CTRL | Pulled enemies collide and take damage on impact. | pattern:pulse |
| 10 | hoarder | Hoarder | vacuum W, magnet P | ECO | Suction pulls coins; each coin sucked: +1% vacuum damage this aisle. | onCoinPickup |
| 11 | lintTrap | Lint Trap | vacuum W, scoby P | DMG | Suction poisons; Full Suck detonates every poisoned enemy in range. | pattern:pulse |
| 12 | breadBasket | Bread Basket | toaster W, multipack M | DMG | Toast splits into 3 crumbs on hit. | pattern:shotHit |
| 13 | burntToast | Burnt Toast | toaster W, ghostpepper P | DMG | Toast ignites; Ghost Pepper heat bonus doubles on toast. | pattern:shotHit |
| 14 | breakfastClub | Breakfast Club | toaster W, sandwich P | DEF | Every 25 toast kills recharge the Emergency Sandwich. | onKill |
| 15 | foamParty | Foam Party | spray W, fireextinguisher P | CTRL | Spray applies Wet; Extinguisher gains +1 charge per aisle. | pattern:cone |
| 16 | pepperSpray | Pepper Spray | spray W, hotsauce M | DMG | Damage ramps +10% per tick an enemy stays in the cone. | pattern:cone |
| 17 | calmMist | Calm Mist | spray W, decaf M | DEF | Every enemy in the cone is weakened, not only direct hits. | pattern:cone |
| 18 | defrost | Defrost | microwave W, ice M | DMG | Zaps on frosted enemies always trigger Shatter. | pattern:zap |
| 19 | popcornSetting | Popcorn Setting | microwave W, popcorn W | DMG | Zapped enemy bursts into 3 kernels. | pattern:zap |
| 20 | leftovers | Leftovers | microwave W, soup P | DEF | Zap kills on elites heal 3 HP. | onKill |
| 21 | tenderizer | Tenderizer | pan W, canopener M | DMG | Sweeps Shred; a sweep on a capped Shred enemy triggers Crack. | pattern:sweep |
| 22 | hotHandle | Hot Handle | pan W, ovenmitts P | DEF | Sweep hits weaken; Oven Mitts range +50%. | pattern:sweep |
| 23 | castIron | Cast Iron | pan W, basil P | DMG | Pan kills count double for Basil; sweep size +5% per 100 kills. | onKill |
| 24 | steamRoom | Steam Room | snowcone W, fuel M | DMG | Burning enemies entering slush Shatter. | pattern:puddleEnter |
| 25 | freezerBurn | Freezer Burn | snowcone W, peas P | DEF | When you lose HP, a slush puddle spawns under the cart. | afterPlayerHit |
| 26 | hotRivets | Hot Rivets | nailgun W, fuel M | DMG | Burning enemies take one extra nail per burst. | pattern:shotHit |
| 27 | nailStrip | Nail Strip | nailgun W, multipack M | DMG | Burst fires 5 nails in a fan instead of 3. | pattern:fire |
| 28 | fermenter | Fermenter | cooker W, moldybread M | CTRL | Spore cloud radius ×1.5; Detonate chains to the next cloud. | pattern:explode |
| 29 | hotPot | Hot Pot | cooker W, snackbag P | DEF | Standing in a pot blast spot regenerates 2× Snack Bag rate. | pattern:explode |
| 30 | rottenTomato | Rotten Tomato | tomato W, scoby P | CTRL | Tomato poison grows like Scoby; Fumes on burning targets. | pattern:shotHit |
| 31 | candyCorn | Candy Corn | popcorn W, jellybeans M | DMG | Each kernel rolls its own Jelly Beans flavor at full strength. | pattern:shotHit |
| 32 | guacamole | Guacamole | blender W, avocado P | DMG | Avocado never browns while touching a blender. | build |
| 33 | wetFloor | Wet Floor Sign | mop W, rubberboots P | MOB | +25% speed in your own puddles; dashing through one splashes Wet. | onDashStart |
| 34 | jackpotFizz | Jackpot Fizz | fizz W, scratchticket P | ECO | A full bounce chain has a 10% chance to drop 5 coins. | pattern:bounce |

## Utility combos (6, cart combos like Sugar Rush, no weapon)

| # | id | Name | Parts | Cat | Effect | Hook |
|---|---|---|---|---|---|---|
| 35 | bowlingNight | Bowling Night | bowlingball P, tipjar P | ECO | Tip Jar chance +2% per occupied cart cell. | onDashHit |
| 36 | freeLunch | Free Lunch | sample P, fortune P | DEF | Free Sample heal cap doubled. | onCrit |
| 37 | comfortFood | Comfort Food | soup P, snackbag P, thermos P | DEF | Regen overflows into the Thermos shield; shield cap +50%. | onTick |
| 38 | rushHour | Rush Hour | sparewheel P, bell P | MOB | Spare Wheel window doubled; the free dash deals full dash damage. | onDashStart |
| 39 | clearanceRack | Clearance Rack | barter P, binder P, expiredcoupon P | ECO | Each sale lowers the next shop's prices by 2% (cap 20%). | build |
| 40 | grandOpening | Grand Opening | flag P, airhorn P | CTRL | Air Horn's automatic blast marks every stunned enemy. | build / hook |

## Totals after the draft

| Weapon | Now | +New | Total |
|---|---|---|---|
| laser | 2 | 4 | 6 |
| leafblower | 2 | 4 | 6 |
| vacuum | 3 | 3 | 6 |
| toaster | 3 | 3 | 6 |
| spray | 3 | 3 | 6 |
| microwave | 3 | 3 | 6 |
| pan | 4 | 3 | 7 |
| snowcone | 4 | 2 | 6 (+ partner in #6) |
| nailgun | 4 | 2 | 6 |
| cooker | 4 | 2 | 6 |
| tomato, popcorn, blender | 5 | 1 | 6 (popcorn + partner in #19) |
| mop, fizz | 6 | 1 | 7 |
| cart (no weapon) | 1 | 6 | 7 |

By category (new only): DMG 15 · CTRL 11 · DEF 9 · ECO 5 · MOB 3. MOB is still thin; Bowling Ball, Balloon and Spare Wheel are the natural sources if more are wanted.

## Open points

- **Ice and fuel are overused.** Ice goes from 7 to 9 combos, fuel from 7 to 11. If that is too much, swap #3 and #18 to Decaf or Jelly Beans, and #26 to Ghost Pepper.
- **Still combo-less (7):** goldstar, balloon, fish, insurance, punchcard, shortcut, spentkey. Gold Star and Spent Key should probably stay that way; the rest are run-level effects with no obvious hook. Fresh Fish + Fortune or Balloon + Bowling Ball are candidates if a few more are wanted.
- **E-press actives are removed.** The Air Horn now blows automatically (8 enemies within 150 px of the cart, 1 / 1 / 2 times per aisle), so #40 (Grand Opening) marks every enemy that blast stuns.
- **Weapon-pair combos** (#6, #19) need both weapons touching, like Frozen Kernels.
- Numbers are first guesses; tune via sims (`src/sims/combo-*.ts`).
