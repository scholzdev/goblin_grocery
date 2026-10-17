import type { DepartmentId, SetId } from '../types';

/** Aisle events: at most one per aisle, never on the boss aisle. Chances are per department. */
export type SetEventKind = 'happyHour' | 'heatwave' | 'powerSurge' | 'flashSale' | 'freezerFail';
export type EventKind = 'wetFloor' | 'outage' | SetEventKind;
/** Set-themed events: the set that boosts (and attracts) each one. */
export const SET_EVENTS: Record<SetEventKind, SetId> = { happyHour: 'snacks', heatwave: 'heat', powerSurge: 'electric', flashSale: 'checkout', freezerFail: 'frost' };
export const SET_EVENT_KINDS = Object.keys(SET_EVENTS) as SetEventKind[];
/** Each set event: `chance` per eligible aisle (x`setWeight` when the matching set is level 1+); `bonus` scales the helpful part when it is. */
export const SET_EVENT = { chance: 0.12, setWeight: 3, bonus: 1.5, minAisle: 2, startAt: [6, 22] as [number, number] };
type Chances = Partial<Record<DepartmentId, number>>;

export const EVENTS = {
  wetFloor: {
    chanceByDept: { main: 0.35, bakery: 0.35, checkout: 0.3, frozen: 0.2, electronics: 0.2 } as Chances,
    minAisle: 2,
    startAt: [12, 35] as [number, number], // seconds into the aisle
    streaks: 3,             // max robot runs
    puddleR: 40,
    puddleSpacing: 125,      // gaps between puddles so a streak is dodgeable, not a river
    dryAfter: 12,           // seconds until a puddle is gone
    playerSlow: 0,          // puddles make you slide instead of slowing you
    playerAccel: 2.5,       // player velocity ease rate on a puddle (1/s): you keep your momentum and steer late
    enemySlow: 0.2,
    robotSpeed: 300,        // px/s
  },
  outage: {
    chanceByDept: { electronics: 0.6, frozen: 0.15, main: 0.12, checkout: 0.15, bakery: 0.1 } as Chances,
    minAisle: 3,
    startAt: [15, 30] as [number, number],
    duration: 16,           // seconds of darkness
    durationPerShift: 2,
    flicker: 1.2,           // seconds of flicker before and after
    coneDeg: 70,
    coneRange: 380,
    glowR: 110,
    darkness: 0.88,
    mouseHold: 4,           // seconds the mouse keeps aiming the headlight after its last move
  },
  happyHour: {
    duration: 15,
    regen: 1,               // extra HP/s for the player
    enemySpeed: 1.15,
  },
  heatwave: {
    duration: 20,
    burnMult: 1.5,          // burn duration (set bonus: 1 + 0.5 x bonus)
    tint: 0xff8a3a,
  },
  powerSurge: {
    duration: 15,
    fireRate: 1.5,          // electrical weapons cycle this much faster (set bonus: 1 + 0.5 x bonus)
    sparkEvery: 1.4,        // seconds between zaps
    tell: 0.9,
    sparkR: 44,
    damage: 2,
  },
  flashSale: {
    duration: 20,
    coinMult: 2,            // kill coins (set bonus: x bonus)
  },
  freezerFail: {
    duration: 20,
    enemySlow: 0.2,         // set bonus: x bonus
    patches: 4,
    patchR: 80,
    playerAccel: 3.2,       // player velocity ease rate on a patch (1/s)
  },
} as const;
