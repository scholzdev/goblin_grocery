# Durability items

Try `http://127.0.0.1:5173/?sim=tank-items`. God mode is off. The cart has Rotten Tomato, Helmet, Frozen Peas, Emergency Sandwich and Thermos; the other five durability items are on the shelf. F8 opens the cart, F9 starts a fresh test. Use the lab item palette to change tiers.

All tuning lives in `src/content/items/<id>.ts`. Copies of the same item use the best effective tier; their effects do not stack. Different percentage reductions multiply. Percentage reductions apply before flat armor, then Thermos shields, then Life Insurance. Only actual HP damage activates Peas or Sandwich.

| Item / file ID | ★1 / ★2 / ★3 |
| --- | --- |
| Oven Mitts / `ovenmitts` | 20 / 25 / 30% less damage from attacks made within 120 of the cart |
| Canned Soup / `soup` | +20 / 30 / 40 max HP; heals 15 / 23 / 30 HP on every third run-wide aisle clear while equipped |
| Shopping Cart Helmet / `helmet` | 2 / 3 / 4 flat armor; hits deal at least 1 before shields |
| Frozen Peas / `peas` | After losing HP to a hit, 30 / 35 / 40% damage reduction for 2 seconds; further damaging hits refresh it |
| Emergency Sandwich / `sandwich` | Heals 20 / 30 / 40 HP after surviving a hit below 25% HP, once per aisle |
| Weighted Blanket / `blanket` | +30 / 45 / 60 max HP and 10 / 15 / 20% damage reduction; movement speed −10% |
| Rubber Boots / `rubberboots` | 50 / 60 / 70% less floor-hazard damage; floor slows are 50 / 65 / 80% weaker |
| Thermos / `thermos` | Stores up to 15 / 23 / 30 excess healing as a shield |
| Loyalty Life Insurance / `insurance` | Legendary: one fatal hit per run leaves 1 HP and grants 3 seconds of invulnerability |

Thermos collects excess healing from regeneration, bread, healing hooks, merge healing, repairs and aisle rewards. The shield persists between aisles, clamps to a lower cap when downgraded, and clears when Thermos leaves the cart. Increasing max HP does not heal or create a shield. Shield is shown above the player while active.

Life Insurance shares one use across every copy, including newly bought copies. Its used flag persists through aisle changes and unequipping; a new run resets it. Emergency Sandwich cannot revive a fatal hit, but can heal after Insurance saves one.

There is no player knockback or timed player-slow status in the current game. Blanket therefore provides damage reduction instead of knockback resistance; Boots reduce the strength of existing wet-floor, gum and slush slows instead of shortening a nonexistent timer.

Normal unlocks: Oven Mitts, Soup and Boots at aisle 2; Helmet and Peas at aisle 3; Blanket and Thermos at aisle 4; Sandwich after finishing a run; Insurance upon reaching the Store Manager. The test lab makes every item available regardless of unlocks.
