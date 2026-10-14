# Departments and route choice

**Status: implemented** (all six departments, hazards, route screen; tuning values below are live in `src/data/departments.ts`).

Goblin Grocery runs used to be 8 identical arenas. Now each aisle is in a **department**. Every department has its own look, a floor hazard, a different enemy mix, and a reward that pushes the next shop in a direction. After every shop you choose **which door to take next**. That gives runs a route, and the route is a strategy decision just like the cart layout.

> Design goals
> - Every door choice is a trade-off you can read in two seconds: danger vs. reward vs. what your build wants.
> - Hazards hurt enemies too. A good player *uses* the floor.
> - No new rules to learn mid-fight: each hazard is telegraphed with the same coral/lavender floor language as enemy attacks.
> - Reuse the single-screen arena. A department changes data, art and one hazard system, not the core loop.

---

## 1. The departments

The **danger** rating (☆ to ★★★) is shown on the door.

### Main Aisle ☆ (tutorial / baseline)
- **Look:** the original mint-and-cream store.
- **Hazard:** none.
- **Enemies:** the normal wave mix.
- **Reward:** none.
- **When:** aisle 1 is always the Main Aisle, so new players learn movement before any hazard.

### Frozen Foods ★☆☆
- **Look:** icy blue checker floor, freezer walls, frost specks.
- **Hazard: ice patches.** 3–4 slick ellipses on the floor.
  - Your steering stays instant; responsive movement is a core rule.
  - A shove that starts on ice travels **1.5× farther**.
  - Enemies on ice slip: **30% slower**, and knockback sends them **1.6× farther**.
  - Coins skate across ice.
- **Enemy mix:** Sour Milk ×2, Soda Six-Pack ×1.5.
- **Modifiers:** enemies −10% speed, +15% HP.
- **Reward:** +20% coins, and the next shop favors cold items (Ice Pack, Blender, Vacuum).

### Bakery ★★☆
- **Look:** warm terracotta and cream tiles, bread racks, oven walls.
- **Hazard: oven vents.** 3 floor grates. Every ~5 s one vent glows: a 1 s coral ring telegraph, then a 0.6 s heat blast.
  - The blast deals 6 damage to the goblin.
  - It deals **15 damage to groceries** standing on it. Lure them in.
- **Enemy mix:** Baguette Bruiser ×2.5, Banana Bandit ×1.5.
- **Reward:** fresh bread. Kills have an 8% chance to drop a crumb that heals 2 HP, **capped at 8 HP per aisle**. The next shop favors Pan, Toaster, Fuel Can, Hot Sauce and Lunchbox.

### Electronics ★★☆
- **Look:** dark teal floor, glowing TV walls, cable clutter.
- **Hazard: live cables.** 2–3 cables lie across the floor. Every ~4 s one flickers for 0.8 s, then is live for 0.5 s.
  - The goblin takes 5 damage.
  - Enemies take 12 damage and are **stunned 0.6 s**.
- **Enemy mix:** Detergent Spitter ×2, Soda Six-Pack ×1.5.
- **Perk while inside:** electrical weapons (Toaster, Nail Gun, Vacuum, Microwave, Blender, Laser) get +15% attack rate.
- **Reward:** the next shop favors Battery, Microwave, Blender, Nail Gun and the Power Strip, with +6% legendary chance.

### Checkout Lanes ★★★
- **Look:** cream and coral lane stripes, register counters.
- **Hazard: conveyor belts.** Two horizontal belts run in opposite directions. Anything standing on one (goblin, groceries, coins) is carried at 90 units/s. Use the belts to kite enemies, or to dodge across the room faster.
- **Enemy mix:** Banana Bandit ×2 plus everything else. +20% enemy count.
- **Reward:** +40% coins, because registers spill cash.
- **Boss:** the final aisle is always **Manager's Checkout**: Checkout Lanes visuals with the Store Manager. The belts are **switched off** for the boss, so his conveyor charge stays fair and readable.

### Clearance Bin ★★★ (special door)
- **Look:** Main Aisle with red sale signage everywhere.
- **Hazard:** none, but **+35% enemies and +25% enemy HP**.
- **Reward:** +50% coins, and the next shop has a **guaranteed legendary** offer.
- **When:** from shop 3 on, there is a 25% chance it replaces one of the offered doors. It's the "I'm strong, let me greed" option.

---

## 2. Route rules

1. Aisle 1 is always the Main Aisle.
2. After shops 1–6 you get **2 doors**, or **3 doors at Loyalty Card Lv 3+**.
   - Doors are distinct.
   - A door never repeats the department you just fought in.
3. From shop 3 on, each set has a 25% chance that one door becomes the Clearance Bin.
4. After shop 7 there is a single door: **Manager's Checkout** (the boss).
5. Doors are rolled from the run seed, so a seed always gives the same route options.
6. The department you fought in tilts the **next** shop's offers toward its themed items (weight ×2.5). Legendary bonuses add to the Loyalty Card odds.

What a door shows:

```
┌──────────────────────────┐
│ [Frozen icon]            │
│ FROZEN FOODS     ★☆☆     │
│ Hazard: ice patches      │
│ Enemies: lots of milk    │
│ +20% coins · cold deals  │
└──────────────────────────┘
```

---

## 3. Example runs

### Example A: "Toast Mode greed" (aggressive)

| Aisle | Doors offered | Pick | Why |
|---|---|---|---|
| 1 | — | Main Aisle | fixed |
| 2 | Frozen ★ / Bakery ★★ | **Bakery** | Toast Mode wants Fuel Can, and Bakery shops favor Fuel/Toaster |
| 3 | Electronics ★★ / Checkout ★★★ | **Electronics** | Toaster is electrical, so +15% fire rate in the fight; Battery deals after |
| 4 | Frozen ★ / **Clearance Bin** ★★★ | **Clearance Bin** | build is online, so cash in a guaranteed legendary (Power Strip!) |
| 5 | Bakery ★★ / Checkout ★★★ | **Checkout** | +40% coins to merge Toasters to ★3 |
| 6 | Frozen ★ / Electronics ★★ | **Frozen** | low HP after Checkout; safest door, and the slide helps escape |
| 7 | Bakery ★★ / Electronics ★★ | **Electronics** | stun cables + Power Strip |
| 8 | — | Manager's Checkout | boss |

### Example B: "Blender bunker" (defensive)
1. Main
2. **Frozen**: cold deals offer a Blender and an Ice Pack, which makes Brain Freeze.
3. **Frozen** can't repeat, so take **Bakery**. Lure baguettes onto the vents while the Blender aura holds them.
4. **Frozen** again: more Ice and Vacuum offers for Cold Storage.
5. Then mostly ★–★★ doors to keep HP high, and Lunchbox/Snack Bag for max HP.

### Example C: a door decision in practice

> After shop 4 you have 31 HP / 55, 64 coins, a ★2 Microwave without its TV Dinner partner, and Loyalty Lv 3, so you see three doors:
> - **Frozen ★** gives +20% coins and cold deals. It's safe, but the deals don't help the Microwave.
> - **Electronics ★★** speeds up your Microwave in the fight and makes the next shop roll Battery/Power Strip more often. That's the TV Dinner piece.
> - **Checkout ★★★** gives +40% coins, but belts plus bananas at 31 HP is risky.
>
> The right call is usually **Electronics**. It advances the build *and* the fight is easier for an electrical build.

---

## 4. Tuning table

**Coins:** the wave-clear bonus is multiplied by `coins`. For kill coins, each kill drops `floor(base × mult)` coins, plus one more coin with probability equal to the fractional part. That makes the average exactly `base × mult`.

| Department | Danger | Enemy HP | Enemy speed | Count | Coins | Shop bias | Legendary + |
|---|---|---|---|---|---|---|---|
| Main Aisle | ☆ | ×1 | ×1 | ×1 | ×1 | none | 0 |
| Frozen Foods | ★ | ×1.15 | ×0.9 | ×1 | ×1.2 | ice, blender, vacuum | 0 |
| Bakery | ★★ | ×1 | ×1 | ×1 | ×1 | pan, toaster, fuel, hotsauce, lunchbox | 0 |
| Electronics | ★★ | ×1 | ×1 | ×1 | ×1 | battery, microwave, blender, nailgun, powerstrip | +6% |
| Checkout Lanes | ★★★ | ×1 | ×1 | ×1.2 | ×1.4 | none | 0 |
| Clearance Bin | ★★★ | ×1.25 | ×1 | ×1.35 | ×1.5 | guaranteed legendary | — |

These values live in `src/data/departments.ts`, next to the rest of the balance data.
