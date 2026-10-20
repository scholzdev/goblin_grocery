import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Tools L3 (boot, bumper, ★2 spare wheel, ★2 tin foil hat: 6 points) + Checkout L1 (tip jar, flag): the dash and shove items, auto-placed around a pan.
export default defineSim({
  id: 'dash-tools',
  notes: 'Dash / shove items. Walk into the cereal and shove (Space) to see them work. Two spitters shoot back.',
  cart: [
    { id: Item.pan, at: [0, 0] },
    { id: Item.boot },
    { id: Item.bumper },
    { id: Item.sparewheel, tier: 2 },
    { id: Item.tinfoilhat, tier: 2 },
    { id: Item.tipjar },
    { id: Item.flag },
  ],
  enemies: [
    { id: Enemy.cereal, count: 6 },
    { id: Enemy.spitter, count: 2, still: false },
  ],
});
