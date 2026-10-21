// Aisle modifiers: the doors after each shop pick how the NEXT aisle plays (the theme is fixed per run).
export type ModifierId = 'none' | 'rush' | 'clearance' | 'event' | 'quiet' | 'stockroom' | 'coldRoom' | 'vipAisle';
/** What a route door can be: a modifier, the boss aisle, or the Shortcut Key's Staff Only door (skips the next aisle). */
export type DoorId = ModifierId | 'boss' | 'shortcut';

export interface ModifierDef {
  countMult: number;
  coinMult: number;
  hpMult: number;
  eliteBonus: number;       // added to the elite chance
  forceLegendary: boolean;  // next shop: at least one legendary offer
  forceEvent: boolean;      // this aisle always has a wet floor / outage
  freeRerolls: number;      // next shop: this many free rerolls
  risk: 0 | 1 | 2 | 3;      // door card stars
}

const n = { countMult: 1, coinMult: 1, hpMult: 1, eliteBonus: 0, forceLegendary: false, forceEvent: false, freeRerolls: 0 };

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  none: { ...n, risk: 0 },
  rush: { ...n, countMult: 1.25, coinMult: 1.25, risk: 2 },
  clearance: { ...n, hpMult: 1.15, eliteBonus: 0.15, forceLegendary: true, risk: 3 },
  event: { ...n, forceEvent: true, freeRerolls: 1, risk: 2 },
  quiet: { ...n, countMult: 0.7, coinMult: 0.75, risk: 1 },
  // Special rooms (see ROOMS): never in the regular door pool.
  stockroom: { ...n, countMult: 0, risk: 0 },
  coldRoom: { ...n, countMult: 0.8, coinMult: 1.25, risk: 2 },
  vipAisle: { ...n, countMult: 0.35, coinMult: 1.25, eliteBonus: 1, risk: 3 }, // eliteBonus 1 = every eligible spawn is Elite
};

export const DOOR_POOL: ModifierId[] = ['none', 'rush', 'event', 'quiet'];

/** Special rooms: rare doors from aisle `fromAisle`. `chance` is rolled per door slot, at most one special door per choice. */
export const ROOM_DOORS: ModifierId[] = ['stockroom', 'coldRoom', 'vipAisle'];
export const ROOMS = {
  chance: 0.1,
  fromAisle: 3,
  stockroom: { choices: 3, crates: 3 },
  coldRoom: { enemySlow: 0.25, playerAccel: 4.5 }, // player velocity eases toward input at this rate (1/s); normal = instant
};
