// Aisle modifiers: the doors after each shop pick how the NEXT aisle plays (the theme is fixed per run).
export type ModifierId = 'none' | 'rush' | 'clearance' | 'event' | 'quiet';
/** What a route door can be: a modifier, or the boss aisle. */
export type DoorId = ModifierId | 'boss';

export interface ModifierDef {
  icon: string;
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
  none: { ...n, icon: '🛒', risk: 0 },
  rush: { ...n, icon: '🏃', countMult: 1.4, coinMult: 1.5, risk: 2 },
  clearance: { ...n, icon: '🏷️', hpMult: 1.15, eliteBonus: 0.15, forceLegendary: true, risk: 3 },
  event: { ...n, icon: '⚡', forceEvent: true, freeRerolls: 1, risk: 2 },
  quiet: { ...n, icon: '🌙', countMult: 0.7, coinMult: 0.75, risk: 1 },
};

export const DOOR_POOL: ModifierId[] = ['none', 'rush', 'event', 'quiet'];
