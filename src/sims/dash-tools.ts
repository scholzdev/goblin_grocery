import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

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
