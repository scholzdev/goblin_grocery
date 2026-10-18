import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS, WET_STATUS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `puddle` (engine/patterns/puddle.ts), like the Mop: a puddle behind the cart whose every tick slows, soaks (`tune.wet`) and hits the enemies inside. The Frost set
// makes its hits frost-tagged. Its own tick soaks and hits in the same frame, which never sets off Ice Sheet (`soakedBefore`): it sets the reaction up for the next frost hit.
const W = weaponBase({ pattern: 'puddle', damage: 3, cooldown: 2, range: 65, tick: 0.5, duration: 4 });

export default defineItem({
  id: Item.snowcone, kind: 'weapon', sets: [Set.kitchen, Set.frost], shape: '2x1', price: 16, tags: ['area'],
  weapon: W,
  tune: { ...weaponTiers(W), range: W.range, duration: W.duration, tick: W.tick, slowPct: 0.35, slowDuration: 0.6, wet: WET_STATUS.duration },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Snow Cone Machine', blurb: 'Flavor: slippery.', rules: 'Every {cooldown|s} drops a slush puddle (radius {range}, lasts {duration|s}). Enemies inside get Wet ({wet|s}): {slowPct|pct} slow and {damage} frost damage every {tick|s}. The next frost hit from another source on a Wet enemy sends it sliding: Ice Sheet.' },
    de: { name: 'Slush-Maschine', blurb: 'Geschmack: rutschig.', rules: 'Hinterlässt alle {cooldown|s} eine Matschpfütze (Radius {range}, hält {duration|s}). Gegner darin werden nass ({wet|s}): {slowPct|pct} langsamer und {damage} Frostschaden alle {tick|s}. Der nächste Frosttreffer einer anderen Quelle auf einen nassen Gegner lässt ihn wegrutschen: Eisfläche.' },
  },
});
