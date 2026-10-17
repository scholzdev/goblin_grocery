import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.piggy, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 10,
  unlock: 'starting',
  tune: { coins: [0.15, 0.225, 0.3] }, // extra kill coins per ★ (15% base x TIER.mult)
  text: {
    en: { name: 'Piggy Bank', blurb: 'Oink. Every grocery chips in.', rules: 'Groceries drop {coins|+pct1} coins (does not stack).' },
    de: { name: 'Sparschwein', blurb: 'Oink. Jeder Gegner zahlt ein.', rules: 'Gegner lassen {coins|+pct1} Münzen fallen (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Kill coins', de: 'Münzen pro Kill' }, key: 'coins', fmt: '+pct1' }],
  build: {
    phase: 'final',
    player(b, c) { b.killCoinMult += c.tune().coins; }, // base 1, so a multiplier of 1.15 at ★1
  },
});
