import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// The other half of the weight system lives in systems/weight.ts: items touching a Balloon are weightless for the Bowling Ball's slow.
export default defineItem({
  id: Item.balloon, kind: 'passive', sets: [Set.snacks], shape: '1x1', price: 10,
  tune: { speed: [0.1, 0.15, 0.2] }, // movement speed per ★ (10% base x TIER.mult)
  text: {
    en: { name: 'Helium Balloon', blurb: 'Lighter than it looks.', rules: '{speed|+pct} movement speed (does not stack). Items touching it do not slow you down through the Bowling Ball.' },
    de: { name: 'Heliumballon', blurb: 'Leichter, als er aussieht.', rules: '{speed|+pct} Bewegungstempo (stapelt sich nicht). Gegenstände, die ihn berühren, bremsen dich nicht durch die Bowlingkugel.' },
  },
  rows: [{ label: { en: 'Move speed', de: 'Lauftempo' }, key: 'speed', fmt: '+pct' }],
  build: {
    phase: 'final',
    player(b, c) { b.moveSpeedMult *= 1 + c.tune().speed; },
  },
});
