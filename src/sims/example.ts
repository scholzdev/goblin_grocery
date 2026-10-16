import { defineSim } from './_sim';

// Reference sim: every field is used once. Copy it to start a new sim (and rename the file and the id).
// Run it with `npm run sim` or http://localhost:5173/?sim=example. Editors autocomplete ids, departments, door mods, events and affixes.
// Only `id` and `cart` are required; delete any other line to get its default (shown in the comments).
export default defineSim({
  id: 'example', // must equal the file name
  notes: 'Reference sim: a frozen aisle with a small cart and a mixed bunch of dummies. F9 restarts it, F8 flips cart <-> arena.',

  // ── scenario ──
  character: 'toaster', // StarterId: toaster | pan | coupon | night (perks only). Default 'toaster'
  aisle: 2, //            1..15 (8 = boss, above = overtime). Default 1
  department: 'frozen', // main | frozen | bakery | electronics | checkout. Default 'main'
  doorMod: 'quiet', //    ModifierId of the aisle. Default 'none'
  event: 'wetFloor', //   'none' | 'random' | wetFloor | outage | happyHour | heatwave | powerSurge | flashSale | freezerFail. Default 'none'
  shift: 0, //            shift index, 0 = Day Shift. Default 0
  waves: false, //        false: dummy sandbox, `enemies` below are the dummies. true: a real aisle run (see wave3 / boss). Default false
  start: 'arena', //      'arena' = straight into the fight, 'shop' = open in the cart editor first. Default 'arena'
  god: true, //           no damage taken. Default true
  // hp: 5, //            HP at the start, capped at the build's max HP (use with god: false). Default: full HP
  money: 500, //          Default 999
  seed: 7, //             fixed seed: same shop offers, rolls and spawn spots every start. Default 1
  cartSize: [6, 4], //    [cols, rows]. Default [7, 5]
  shopLevel: 2, //        loyalty level 1..3. Default 1

  // ── the cart: exactly these items, the starter weapon is not added ──
  cart: [
    { id: 'toaster', tier: 2, at: [0, 0] }, //          tier 1..3; `at` is the top-left cell of the footprint
    { id: 'fan', at: [2, 0], rot: 0 }, //                 modules only buff ADJACENT weapons: the fan sits next to the toaster
    { id: 'jellybeans', at: [0, 1], flavor: 'frost' }, // flavor: heat | frost | blast (re-rolls when you open the cart editor)
    { id: 'pan' }, //                                     no `at`: goes to the first spot that fits (all rotations tried)
  ],
  // Items waiting on the shelf; they do not count for the build.
  shelf: [{ id: 'bell' }, { id: 'battery', tier: 2 }],

  // ── dummies (only with waves: false) ──
  enemies: [
    { id: 'milk', count: 3, spread: 'cluster' }, //                 one tight bunch of three. spread: random (default) | cluster | ring
    { id: 'cereal', count: 4, spread: 'ring', still: true }, //     a ring around you, standing still (default still: false)
    { id: 'banana', affix: 'swift' }, //                            an elite: swift | tough | splitter | pickpocket, or 'elite' for a random one
    { id: 'soda', at: [900, 360], immortal: false }, //             exact spot in the arena (x 78..1202, y 196..758); it can die (default immortal: true)
    { id: 'melon', mini: 0 }, //                                    mid-shift boss variant 0
  ],
});
