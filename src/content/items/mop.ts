import { cells, defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';

// Pattern `puddle` (engine/patterns/puddle.ts): a puddle of radius `range` behind the cart that lives `duration` s and ticks every `tick` s. Its slow is `tune.slowPct`
// for `tune.slowDuration` s (the old `PUDDLE.slow`, stronger with the Frost set); Black Ice hooks `pattern:puddleEnter`, Grease Fire changes the sprite through `pattern:look`.
const W = weaponBase({ pattern: 'puddle', damage: 3, cooldown: 1.6, range: 60, tick: 0.5, duration: 3 });

export default defineItem({
  id: 'mop', kind: 'weapon', sets: ['cleaning', 'frost'], shape: cells('#.', '#.', '##'), price: 11, tags: ['area'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, duration: W.duration, tick: W.tick, slowPct: 0.25, slowDuration: 0.5 },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Mop', blurb: 'Leaves slippery soap puddles behind you.', rules: 'Every {cooldown|s} drops a soap puddle (radius {range}, lasts {duration|s}). Enemies inside slip: {slowPct|pct} slow and {damage} damage every {tick|s}.' },
    de: { name: 'Wischmopp', blurb: 'Hinterlässt rutschige Seifenpfützen.', rules: 'Hinterlässt alle {cooldown|s} eine Seifenpfütze (Radius {range}, hält {duration|s}). Gegner darin rutschen: {slowPct|pct} langsamer und {damage} Schaden alle {tick|s}.' },
  },
});
