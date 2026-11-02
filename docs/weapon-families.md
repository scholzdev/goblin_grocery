# Weapon families and pairings

Normal runs own at most two distinct weapon types, from different families, and equip at most two weapon instances. Shelf copies count as owned; duplicates are allowed for merging. Sell every copy of a type to free its slot. Lab loadouts remain unrestricted. Blocked free loot pays its sell value instead, disclosed before selection. Existing profile unlocks remain intact; Barcode Laser now requires a two-weapon win.

| Family | Weapons | Role |
| --- | --- | --- |
| Hunter | Toaster, Self-Checkout Laser, Microwave, Nail Gun | Wounded-target finisher, line piercer, repeated-target ramp, focused burst |
| Spreader | Fizz Cannon, Popcorn Maker, Pressure Cooker, Blender | Ricochet, distributed barrage, delayed blast, close-range shred |
| Primer | Rotten Tomato, Spray Bottle, Mop, Snow Cone Machine | Poison, Wet, persistent trail, frost setup |
| Controller | Leaf Blower, Frying Pan, Vacuum | Wall slams, defensive knockback, grouping/pickups |

Existing names, module combos and star-three effects are retained. Toaster gains +50% direct damage below half health and prioritizes wounded enemies. Nail Gun locks its burst and gains 8% per consecutive hit up to 40%, resetting after a target change or 1.5 seconds. Microwave gains 25% per repeated zap at the same target, up to 75%, resetting on a target change. Other weapons already implement their assigned core behavior; their identity text explains strengths and tradeoffs.

Pairings activate on orthogonal weapon adjacency, never from the shelf or diagonals. One handler per family pair prevents duplicate-copy stacking. Pair marks live only for the current aisle and enemy status instance.

| Pair | Interaction | Initial tuning |
| --- | --- | --- |
| Hunter + Spreader | Overkill | Hunter primary kills trigger a 90-radius blast for 40% of the strongest touching Spreader's damage; generated kills cannot retrigger it. |
| Hunter + Primer | Exploit | Primer primary hits mark for 3 s. The paired Hunter consumes the mark for +50% direct damage. Poison and Wet remain. |
| Hunter + Controller | Pinpoint | Controller hits establish 1.5 s control; Vacuum suction refreshes it. Hunters prioritize those targets and roll a 35% conditional crit. Manual aim remains authoritative. |
| Spreader + Primer | Contagion | A Spreader hit on a directly primed enemy transfers active poison, burn, Wet and slow within 90 at half strength/duration. Consumes the seed; transfers cannot seed another spread. |
| Spreader + Controller | Compression | +35% Spreader damage during control if at least two other enemies are within 90. |
| Primer + Controller | Hazard | Primer hits during control extend poison/Wet by 1 s (up to an 8 s horizon), and add 10 percentage points of slow, capped at 65%. |

Regression invariants are exercised through the real combat pipeline in `tests/weapon-pairings.test.ts` and through purchase, reward, preview, movement and departure rules in `tests/weapon-loadout.test.ts`. Runtime hooks are shared by Phaser and the headless simulator. Pattern implementations remain independent of item identity.

Verification caught that Hazard must use already-resolved status values: calling the Wet-aware slow helper again would apply the Wet bonus twice. Status-instance keys also prevent a pooled enemy from inheriting another spawn's pairing marks. These cases have regression coverage.

These are initial balance values. Deterministic tests establish effect correctness; the simulator is a balance diagnostic, and human play remains necessary for feel and difficulty tuning.
