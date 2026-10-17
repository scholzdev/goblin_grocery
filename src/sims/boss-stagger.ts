import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Boss weakness stagger: the Walk-In Freezer (weak to heat) as an immortal dummy, a heat-only cart in front of it. It keeps walking and attacking.
export default defineSim({
  id: 'boss-stagger',
  department: 'frozen',
  notes: 'Walk-In Freezer (1700 HP) is weak to heat (+40%) and resists frost. A heat hit that lands while it walks staggers it for 0.25 s with a WEAK! flash, at most once every 4 s; it never interrupts a tell, a charge or a recovery. Frying Pan ★3 and Pressure Cooker ★3 are heat: the pan hits for 28 and a pot for 49 (their Kitchen set bonus and the +40%). Dash in with Space to see it keep its charge window.',
  cart: [
    { id: Item.pan, tier: 3, at: [1, 1] },
    { id: Item.cooker, tier: 3, at: [3, 1] },
  ],
  enemies: [
    { id: Enemy.boss_frozen, count: 1, at: [640, 330] },
  ],
});
