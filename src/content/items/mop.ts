import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS, WET_STATUS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `puddle` (engine/patterns/puddle.ts): a puddle of radius `range` behind the cart that lives `duration` s and ticks every `tick` s. Its slow is `tune.slowPct`
// for `tune.slowDuration` s (the old `PUDDLE.slow`, stronger with the Frost set); every tick also leaves `tune.wet` s of Wet on the enemies inside; from ★3 a puddle lives
// `tune.lifeMult` x its duration (the Cleaning set's extra seconds included). Black Ice hooks `pattern:puddleEnter`, Grease Fire changes the sprite through `pattern:look`.
const W = weaponBase({ pattern: 'puddle', damage: 3, cooldown: 1.6, range: 60, tick: 0.5, duration: 3 });

export default defineItem({
  id: Item.mop, kind: 'weapon', sets: [Set.cleaning, Set.frost], shape: cells('#.', '#.', '##'), price: 11, tags: ['area'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, duration: W.duration, tick: W.tick, slowPct: 0.25, slowDuration: 0.5, wet: WET_STATUS.duration, lifeMult: 2 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Mop', blurb: 'Leaves slippery soap puddles behind you.', rules: 'Every {cooldown|s} drops a soap puddle (radius {range}, lasts {duration|s}). Enemies inside slip and get Wet ({wet|s}): {slowPct|pct} slow and {damage} damage every {tick|s}.', star3: '★3: Puddles last {lifeMult|x} as long.' },
    de: { name: 'Wischmopp', blurb: 'Hinterlässt rutschige Seifenpfützen.', rules: 'Hinterlässt alle {cooldown|s} eine Seifenpfütze (Radius {range}, hält {duration|s}). Gegner darin rutschen und werden nass ({wet|s}): {slowPct|pct} langsamer und {damage} Schaden alle {tick|s}.', star3: '★3: Pfützen halten {lifeMult|x} so lange.' },
  },
});
