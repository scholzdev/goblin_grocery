import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

// Tools L3 (boot, bumper, spare wheel, tin foil hat) + Checkout L1 (tip jar, flag): the dash and shove items, auto-placed around a pan.
export default defineSim({
  id: 'dash-tools',
  notes: 'Dash / shove items. Walk into the cereal and shove (Space) to see them work. Two spitters shoot back.',
  cart: [
    { id: Item.pan, at: [0, 0] },
    { id: Item.boot },
    { id: Item.bumper },
    { id: Item.sparewheel },
    { id: Item.tinfoilhat },
    { id: Item.tipjar },
    { id: Item.flag },
  ],
  enemies: [
    { id: Enemy.cereal, count: 6 },
    { id: Enemy.spitter, count: 2, still: false },
  ],
});
