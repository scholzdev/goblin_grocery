import { defineSim } from './_sim';

// Tools L3 (boot, bumper, spare wheel, tin foil hat) + Checkout L1 (tip jar, flag): the dash and shove items, auto-placed around a pan.
export default defineSim({
  id: 'dash-tools',
  notes: 'Dash / shove items. Walk into the cereal and shove (Space) to see them work. Two spitters shoot back.',
  cart: [
    { id: 'pan', at: [0, 0] },
    { id: 'boot' },
    { id: 'bumper' },
    { id: 'sparewheel' },
    { id: 'tinfoilhat' },
    { id: 'tipjar' },
    { id: 'flag' },
  ],
  enemies: [
    { id: 'cereal', count: 6 },
    { id: 'spitter', count: 2, still: false },
  ],
});
