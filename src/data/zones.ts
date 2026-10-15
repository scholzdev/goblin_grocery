import type { DepartmentId, EnemyId } from '../types';
import { o, type Obstacle } from './obstacles';

// Aisle zones: 3 per theme. A zone = 2 obstacle layouts + hazard-count bias + one enemy-mix tilt. Every route door shows its zone.
export type ZoneId =
  | 'cereal_wall' | 'can_pyramids' | 'promo_island'
  | 'freezer_row' | 'icecream_island' | 'walk_in'
  | 'oven_line' | 'bread_racks' | 'cake_counter'
  | 'tv_wall' | 'cable_aisle' | 'demo_booths'
  | 'conveyor_lanes' | 'self_checkout' | 'cart_corral';

export interface ZoneDef {
  id: ZoneId; theme: DepartmentId; name: string; blurb: string;
  /** Exactly 2 layouts; one is picked per wave. Must stay clear of the theme's hazards at their max count (tests). */
  layouts: Obstacle[][];
  /** Added to the hazard spot count (clamped to 1..available). */
  hazardExtra: number;
  /** Enemy-mix multipliers (ZONE_TUNING.tilt) for this zone. */
  tilt: Partial<Record<EnemyId, number>>;
}

export const ZONE_TUNING = {
  tilt: 1.5,
  /** Door weight = 1 / (1 + timesUsedThisRun) ** repeatPenalty. */
  repeatPenalty: 2,
};
const T = ZONE_TUNING.tilt;

export const ZONES: Record<ZoneId, ZoneDef> = {
  cereal_wall: { id: 'cereal_wall', theme: 'main', name: 'Cereal Wall', blurb: 'Long gondola lanes', hazardExtra: 0, tilt: { cereal: T }, layouts: [
    [o('gondola', 280, 330), o('gondola', 960, 330), o('gondola', 300, 640), o('gondola', 980, 640)],
    [o('gondola', 400, 470), o('gondola', 880, 560), o('display', 640, 330)],
  ] },
  can_pyramids: { id: 'can_pyramids', theme: 'main', name: 'Can Pyramids', blurb: 'Stacks everywhere to hide behind', hazardExtra: 0, tilt: { beans: T }, layouts: [
    [o('can_stack', 260, 340), o('can_stack', 640, 330), o('can_stack', 1020, 340), o('can_stack', 330, 610), o('can_stack', 950, 610)],
    [o('can_stack', 400, 420), o('can_stack', 880, 420), o('can_stack', 640, 330), o('display', 250, 620)],
  ] },
  promo_island: { id: 'promo_island', theme: 'main', name: 'Promo Island', blurb: 'Big bin, circle it', hazardExtra: 0, tilt: { soda: T }, layouts: [
    [o('bargain_bin', 640, 325), o('display', 260, 600), o('display', 1020, 600)],
    [o('display', 640, 330), o('bargain_bin', 420, 480), o('bargain_bin', 860, 480)],
  ] },
  freezer_row: { id: 'freezer_row', theme: 'frozen', name: 'Freezer Row', blurb: 'Chest freezers, extra ice', hazardExtra: 1, tilt: { turkey: T }, layouts: [
    [o('chest_freezer', 400, 480), o('chest_freezer', 880, 480)],
    [o('chest_freezer', 300, 430), o('chest_freezer', 980, 430)],
  ] },
  icecream_island: { id: 'icecream_island', theme: 'frozen', name: 'Ice Cream Island', blurb: 'One freezer island mid-floor', hazardExtra: 0, tilt: { milk: T }, layouts: [
    [o('icecream_case', 430, 430), o('icecream_case', 850, 430)],
    [o('icecream_case', 430, 520), o('icecream_case', 850, 520)],
  ] },
  walk_in: { id: 'walk_in', theme: 'frozen', name: 'Walk-in Cooler', blurb: 'Tight and cluttered, less ice', hazardExtra: -1, tilt: { expired: T }, layouts: [
    [o('icecream_case', 430, 430), o('icecream_case', 850, 430), o('icecream_case', 1070, 570)],
    [o('icecream_case', 300, 430), o('icecream_case', 980, 430)],
  ] },
  oven_line: { id: 'oven_line', theme: 'bakery', name: 'Oven Line', blurb: 'Hardly any cover, hot vents', hazardExtra: 2, tilt: { baguette: T }, layouts: [
    [o('bread_rack', 470, 330), o('bread_rack', 810, 330)],
    [o('flour_sacks', 470, 610), o('flour_sacks', 810, 610)],
  ] },
  bread_racks: { id: 'bread_racks', theme: 'bakery', name: 'Bread Racks', blurb: 'Rack rows form lanes', hazardExtra: 0, tilt: { honey: T }, layouts: [
    [o('bread_rack', 300, 330), o('bread_rack', 980, 330), o('bread_rack', 470, 615), o('bread_rack', 810, 615)],
    [o('flour_sacks', 470, 610), o('bread_rack', 1000, 620), o('bread_rack', 240, 330)],
  ] },
  cake_counter: { id: 'cake_counter', theme: 'bakery', name: 'Cake Counter', blurb: 'Counters at the edge, open middle', hazardExtra: -1, tilt: { egg: T }, layouts: [
    [o('flour_sacks', 230, 330), o('flour_sacks', 1000, 330), o('flour_sacks', 950, 640)],
    [o('bread_rack', 240, 330), o('flour_sacks', 1000, 330), o('flour_sacks', 310, 630)],
  ] },
  tv_wall: { id: 'tv_wall', theme: 'electronics', name: 'TV Wall', blurb: 'Sparse, long sightlines', hazardExtra: 0, tilt: { spitter: T }, layouts: [
    [o('tv_boxes', 900, 370), o('tv_boxes', 380, 560)],
    [o('tv_boxes', 1000, 330), o('tv_boxes', 300, 570)],
  ] },
  cable_aisle: { id: 'cable_aisle', theme: 'electronics', name: 'Cable Aisle', blurb: 'Spools and extra live cables', hazardExtra: 1, tilt: { beans: T }, layouts: [
    [o('cable_spool', 400, 560), o('cable_spool', 900, 340)],
    [o('cable_spool', 320, 550), o('cable_spool', 1040, 340)],
  ] },
  demo_booths: { id: 'demo_booths', theme: 'electronics', name: 'Demo Booths', blurb: 'Island booths to duck behind', hazardExtra: 0, tilt: { cereal: T }, layouts: [
    [o('kiosk', 900, 340), o('kiosk', 380, 560)],
    [o('kiosk', 820, 330), o('kiosk', 1060, 430), o('kiosk', 330, 550)],
  ] },
  conveyor_lanes: { id: 'conveyor_lanes', theme: 'checkout', name: 'Conveyor Lanes', blurb: 'Dividers along the belts', hazardExtra: 0, tilt: { gum: T }, layouts: [
    [o('lane_divider', 270, 470), o('lane_divider', 1010, 470)],
    [o('lane_divider', 420, 480), o('lane_divider', 860, 480), o('lane_divider', 640, 296)],
  ] },
  self_checkout: { id: 'self_checkout', theme: 'checkout', name: 'Self-Checkout', blurb: 'Kiosks scattered about', hazardExtra: 0, tilt: { melon: T }, layouts: [
    [o('kiosk', 300, 470), o('kiosk', 980, 470), o('kiosk', 640, 296)],
    [o('kiosk', 440, 480), o('kiosk', 840, 480)],
  ] },
  cart_corral: { id: 'cart_corral', theme: 'checkout', name: 'Cart Corral', blurb: 'Lots of little blockers', hazardExtra: 0, tilt: { banana: T }, layouts: [
    [o('cart_stack', 250, 470), o('cart_stack', 450, 470), o('cart_stack', 830, 470), o('cart_stack', 1030, 470), o('cart_stack', 640, 296)],
    [o('cart_stack', 250, 540), o('cart_stack', 450, 540), o('cart_stack', 830, 540), o('cart_stack', 1030, 540), o('cart_stack', 640, 296)],
  ] },
};

export const ZONE_IDS = Object.keys(ZONES) as ZoneId[];
export const zonesOf = (theme: DepartmentId): ZoneDef[] => ZONE_IDS.map((id) => ZONES[id]).filter((z) => z.theme === theme);
