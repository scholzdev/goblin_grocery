# Themes and aisle modifiers

**Status: implemented** (tuning values live in `src/data/departments.ts` and `src/data/modifiers.ts`).

A run has one **theme** (department), picked on the start screen (`T` cycles). All 7 aisles, and overtime, use that theme's look, floor hazard and enemy roster. The doors after each shop no longer choose a department: they choose an **aisle modifier** for the next aisle. Aisle 8 is always the Store Manager, now with themed summons.

> Design goals
> - The theme is a build/play-style choice you make once; the modifiers are the per-aisle risk/reward decision.
> - Hazards hurt enemies too. A good player *uses* the floor.
> - Reuse the single-screen arena: a theme changes data, art and one hazard system.

---

## 1. Themes

All five are open from the start. Theme multipliers (HP, speed, count, coins) are flat 1 now that a theme applies to every aisle.

| Theme | Hazard | Roster (weight multiplier on the wave mix) | Perk / shop bias |
|---|---|---|---|
| Main Aisle | none | Cereal 2.5, Beans 2.5, Soda 2, Honey 2 | none |
| Frozen Foods | ice patches | Turkey 2.5, Expired Milk 2.5, Sour Milk 2, Soda 2 | fuel, toaster, hotsauce |
| Bakery | oven vents | Baguette 2.5, Egg 2.5, Honey 2.5, Banana 1.5 | crumbs heal; pan, toaster, fuel, hot sauce, lunchbox |
| Electronics | live cables | Spitter 2.5, Beans 2, Cereal 2, Expired Milk 1.5 | electrical weapons +15% rate; battery, microwave, blender, nail gun, power strip; +3% legendary chance |
| Checkout Lanes | conveyor belts | Gum 2.5, Melon 2.5, Banana 2, Gift Card 2 | none |

**Spawn weights** (`waveSpawnPlan`): `wave mix × theme weight`. Enemies not in the roster get `DEPT_TUNING.offTheme` (0.35), except the basics Sour Milk, Banana and Gift Card which stay at 1. The wave mix still gates by aisle, so late enemies only appear late. There is no Clearance department; the Clearance Sale aisles (a door modifier) have their own music.

### Hazards

- **Ice:** longer shoves (x1.5), enemies 30% slower, knockback x1.6, coins skate.
- **Vents:** every ~5 s a vent telegraphs for 1 s, then blasts for 0.6 s (6 damage to the goblin, 15 to groceries).
- **Cables:** every ~4 s a cable flickers 0.8 s, then is live for 0.5 s (5 damage to the goblin, 12 and a 0.6 s stun to groceries).
- **Conveyor:** belts carry everything at 90 units/s.
- **Ramp:** +1 ice patch / vent / cable per 3 aisles (`floor((aisle-1)/3)`), conveyor speed x(1 + 0.04 x (aisle-1)). Overtime uses the aisle-7 values. The boss aisle has no hazards.

---

## 2. Aisle modifiers (the doors)

| Modifier | Effect on the aisle | Reward |
|---|---|---|
| Regular aisle | none | none |
| Rush Hour (★★) | +40% groceries | +25% coins |
| Quiet Aisle (★) | -30% groceries | -25% coins |
| Aisle Event (★★) | a wet floor or power outage always hits | 1 free reroll in the next shop |
| Clearance Sale (★★★) | +15% HP, +15% elite chance | guaranteed legendary in the next shop |

Modifiers multiply on top of the theme. Coin multipliers apply to kill coins and the wave-clear bonus.

### Route rules

1. Aisle 1 is a regular aisle of your theme.
2. After shops 1-6 you get **2 doors**, or **3 at Loyalty Card Lv 3+**, distinct, drawn from Regular / Rush / Event / Quiet.
3. From shop 3 on there is a 25% chance that the last door becomes Clearance Sale (never right after a Clearance Sale).
4. After shop 7 there is a single door: the boss aisle, named after the run theme's boss (not in overtime; overtime doors are modifiers again).
5. Doors are rolled from the run seed.

### Boss

Aisle 8 has one boss per theme (each boss's file in `src/content/enemies/` names its theme and kit; `BOSS_BY_THEME` / `BOSS_KITS` in `src/data/enemies.ts` are derived from them; `ArenaScene.spawnBoss` picks by `state.theme`, the Lab and F3 use the run's theme). Every boss is an enemy def with `behavior: 'boss'` (all boss checks key on the behavior) and sprites `boss_<theme>_a|b|tell` (`boss_a|b|tell` for the Manager). Shift multipliers (`bossHpMult`, volley/summon bonuses, coins) apply to all of them.

| Theme | Boss | HP | Loop (S = signature move) | Signature |
|---|---|---|---|---|
| Main | The Store Manager | 1500 | volley, charge, summon, charge, volley, summon | none (receipt volleys, conveyor charge) |
| Frozen | The Walk-In Freezer | 1700 | S, volley, charge, summon, S, charge | Cold Snap: 3 telegraphed circles (4 at half HP), one on you; hits and leaves 7 s of slush (the gum slow, ice tint) |
| Bakery | The Industrial Oven | 1450 | volley, S, summon, charge, S, volley | Flame Burst: ring of 14 slow toast shots (18 at half HP), random rotation, telegraphed spokes |
| Electronics | The Smart-TV Wall | 1500 | S, volley, summon, S, charge, volley | Cable Zap: 3 vertical live-cable strips (5 at half HP) locked at the tell, hit if you stand in one |
| Checkout | The Self-Checkout Kiosk | 1550 | S, charge, volley, summon, charge, S | Conveyor Shift: scrolling arrows, then a 170 px/s sideways shove toward the boss for 2.4 s |

Summons: each summoned grocery has a 50% chance to come from the theme's summon pool (`THEME_SUMMONS`): Main Cereal/Beans, Frozen Expired/Sour Milk, Bakery Baguette/Banana, Electronics Spitter/Beans, Checkout Gum/Banana. Otherwise it uses the boss's own list (`BossKit.moves.summonTypes`; the Manager uses the shift's usual list). Volley/summon counts per boss live in its file (`boss.kit.moves`, derived as `BOSS_KITS`); the signature numbers are that boss's `tune` (derived as `BOSS_SPECIAL`).

### Mid-shift boss (aisle 4)

Arrives 8 s into aisle 4 (not on Stockroom). Each run rolls one of `MINI_BOSS.variants` with `flow.rng` when it spawns: variant 1 (soda / turkey / baguette / spitter / banana) is the stampeder (5-shot 60 deg volleys, 2 summons), variant 2 (cereal / expired milk / egg / beans / gum) the skirmisher (faster, 3-shot 26 deg bubble volleys, 4 summons, shorter charge, different loop). Killing it ends the aisle and offers 3 crates; crate positions avoid every prop, edge dressing and the player start (`crateSpots` in `src/data/obstacles.ts`, tested over all layouts).

### Unlocks

`deptClears` counts cleared aisles per department; cleared Clearance Sale aisles also count for `clearance`. Mop, Blender, Coupon and Cooker need 3 cleared aisles of their theme, the Frost skin 12 Frozen aisles, the coral cart 1 Clearance aisle.
