# Mechanics metrics

- A = /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/baseline/starting.json: 600 runs, seed 1, starter all, weapon toaster,pan,nailgun, shift 0, theme main, pool starting, policy greedy, rev 2b0b851
- B = /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/baseline/all.json: 600 runs, seed 1, starter all, weapon toaster,pan,nailgun, shift 0, theme main, pool all, policy greedy, rev 2b0b851
- The inputs differ in pool. Read the deltas with that in mind.

## Overview

| metric | A | B | B - A |
| --- | ---: | ---: | ---: |
| runs | 600 | 600 | 0 |
| win rate | 47.3% | 26.2% | -21.2 pts |
| win rate standard error | 2.0% | 1.8% | -0.2 pts |
| average aisle reached | 6.71 | 6.20 | -0.50 |
| merges per run | 3.64 | 1.00 | -2.64 |
| ★2 items at run end | 2139 | 965 | -1174 |
| ★2 items per run | 3.56 | 1.61 | -1.96 |
| ★3 items at run end | 223 | 13 | -210 |
| ★3 items per run | 0.37 | 0.02 | -0.35 |
| combos at run end per run | 2.30 | 1.57 | -0.72 |
| distinct combos at run end | 10 | 29 | +19 |
| weapons at run end per run | 2.43 | 2.15 | -0.28 |
| rerolls per run | 0.00 | 0.00 | 0.00 |
| sells per run | 0.00 | 0.00 | 0.00 |

## Runs that reached the aisle

| aisle | A | B | B - A |
| --- | ---: | ---: | ---: |
| 1 | 600 | 600 | 0 |
| 2 | 600 | 600 | 0 |
| 3 | 600 | 600 | 0 |
| 4 | 592 | 594 | +2 |
| 5 | 495 | 448 | -47 |
| 6 | 442 | 381 | -61 |
| 7 | 384 | 286 | -98 |
| 8 | 310 | 211 | -99 |

## Share of all deaths, by aisle

| aisle | A | B | B - A |
| --- | ---: | ---: | ---: |
| 1 | 0.0% | 0.0% | 0.0 pts |
| 2 | 0.0% | 0.0% | 0.0 pts |
| 3 | 2.5% | 1.4% | -1.2 pts |
| 4 | 30.7% | 33.0% | +2.3 pts |
| 5 | 16.8% | 15.1% | -1.6 pts |
| 6 | 18.4% | 21.2% | +2.9 pts |
| 7 | 23.4% | 17.2% | -6.3 pts |
| 8 | 8.2% | 12.2% | +4.0 pts |

## Death rate among runs that reached the aisle

| aisle | A | B | B - A |
| --- | ---: | ---: | ---: |
| 1 | 0.0% | 0.0% | 0.0 pts |
| 2 | 0.0% | 0.0% | 0.0 pts |
| 3 | 1.3% | 1.0% | -0.3 pts |
| 4 | 16.4% | 24.6% | +8.2 pts |
| 5 | 10.7% | 15.0% | +4.2 pts |
| 6 | 13.1% | 24.7% | +11.5 pts |
| 7 | 19.3% | 26.6% | +7.3 pts |
| 8 | 8.4% | 25.6% | +17.2 pts |

## HP lost by aisle (fights only)

| aisle | A | B | B - A |
| --- | ---: | ---: | ---: |
| 1 | 2.24 | 2.24 | 0.00 |
| 2 | 0.49 | 0.53 | +0.04 |
| 3 | 6.20 | 7.71 | +1.51 |
| 4 | 13.89 | 18.12 | +4.24 |
| 5 | 14.72 | 17.18 | +2.46 |
| 6 | 19.79 | 24.44 | +4.65 |
| 7 | 23.66 | 28.22 | +4.56 |
| 8 | 15.77 | 27.17 | +11.40 |

## Coins at shop entry

| shop | A | B | B - A |
| --- | ---: | ---: | ---: |
| 1 | 25.93 | 25.93 | 0.00 |
| 2 | 27.96 | 27.75 | -0.21 |
| 3 | 36.62 | 35.55 | -1.07 |
| 4 | 40.16 | 42.40 | +2.24 |
| 5 | 65.93 | 59.62 | -6.31 |
| 6 | 74.56 | 70.32 | -4.24 |
| 7 | 85.30 | 77.23 | -8.06 |

## Combo formation (share of runs with the combo active at run end)

| combo | A | B | B - A |
| --- | ---: | ---: | ---: |
| expressCheckout | 43.3% | 34.3% | -9.0 pts |
| nailstorm | 35.0% | 28.2% | -6.8 pts |
| toastMode | 33.2% | 29.8% | -3.3 pts |
| sizzlingSkillet | 27.7% | 7.2% | -20.5 pts |
| frostbiteNails | 23.3% | 7.3% | -16.0 pts |
| chickenDinner | 21.7% | 5.2% | -16.5 pts |
| smashBank | 21.5% | 4.0% | -17.5 pts |
| fiveAlarm | 17.3% | 4.3% | -13.0 pts |
| freshBread | 0.0% | 5.7% | +5.7 pts |
| rayGun | 0.0% | 5.2% | +5.2 pts |
| crackOpen | 0.0% | 4.5% | +4.5 pts |
| staticCling | 4.5% | 0.7% | -3.8 pts |
| mistMachine | 0.0% | 3.5% | +3.5 pts |
| pressureWasher | 0.0% | 2.7% | +2.7 pts |
| coldStorage | 2.5% | 0.2% | -2.3 pts |
| brainFreeze | 0.0% | 2.3% | +2.3 pts |
| greaseFire | 0.0% | 2.3% | +2.3 pts |
| kettleCorn | 0.0% | 2.0% | +2.0 pts |
| slushie | 0.0% | 1.5% | +1.5 pts |
| confettiCannon | 0.0% | 1.3% | +1.3 pts |
| smoothieShield | 0.0% | 1.2% | +1.2 pts |
| reheat | 0.0% | 1.0% | +1.0 pts |
| blackIce | 0.0% | 0.8% | +0.8 pts |
| shrapnel | 0.0% | 0.7% | +0.7 pts |
| sugarRush | 0.0% | 0.7% | +0.7 pts |
| potSlam | 0.0% | 0.5% | +0.5 pts |
| fireworksShow | 0.0% | 0.2% | +0.2 pts |
| liveWire | 0.0% | 0.2% | +0.2 pts |
| tailwind | 0.0% | 0.2% | +0.2 pts |

## Sets at level 2 or more at run end

| set | A | B | B - A |
| --- | ---: | ---: | ---: |
| kitchen | 60.7% | 47.3% | -13.3 pts |
| tools | 56.3% | 55.5% | -0.8 pts |
| heat | 55.3% | 27.3% | -28.0 pts |
| checkout | 18.3% | 28.3% | +10.0 pts |
| electric | 26.8% | 14.2% | -12.7 pts |
| snacks | 18.7% | 25.5% | +6.8 pts |
| blast | 4.8% | 12.0% | +7.2 pts |
| cleaning | 1.5% | 2.7% | +1.2 pts |
| frost | 0.0% | 2.0% | +2.0 pts |

## Sets at level 3 at run end

| set | A | B | B - A |
| --- | ---: | ---: | ---: |
| tools | 23.5% | 30.5% | +7.0 pts |
| kitchen | 29.5% | 23.5% | -6.0 pts |
| heat | 15.0% | 6.0% | -9.0 pts |
| snacks | 5.5% | 11.5% | +6.0 pts |
| checkout | 2.5% | 10.3% | +7.8 pts |
| blast | 0.0% | 2.7% | +2.7 pts |
| electric | 1.5% | 1.5% | 0.0 pts |
| cleaning | 0.0% | 0.0% | 0.0 pts |
| frost | 0.0% | 0.0% | 0.0 pts |
