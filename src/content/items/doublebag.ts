import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'doublebag', kind: 'module', sets: ['checkout', 'blast'], shape: '2x1', price: 12, buff: 'echo', // the buff id is `echo`
  tune: { fraction: [0.5, 0.75, 1], delay: 0.12 }, // second strike's share of the hit per ★ (the legacy 50% base x TIER.mult); the delay is flat
  text: {
    en: { name: 'Double Bag', blurb: 'Twice the bag, twice the whack.', rules: 'Direct hits from adjacent weapons strike a second time {delay|s} later for {fraction|pct} damage.' },
    de: { name: 'Doppeltüte', blurb: 'Doppelte Tüte, doppelter Wumms.', rules: 'Direkte Treffer angrenzender Waffen schlagen {delay|s} später ein zweites Mal zu, für {fraction|pct} Schaden.' },
  },
  rows: [{ label: { en: 'Double hit', de: 'Doppeltreffer' }, key: 'fraction', fmt: 'pct' }],
  build: {
    phase: 'module', order: 90,
    weapon(w, c) {
      if (w.pattern === 'aura' || w.pattern === 'puddle') return false; // no direct hits to repeat: not recorded
      w.echo = Math.min(1, c.tune().fraction); // never more than the original hit, so Gold Star's effective ★4 (125%) caps at 100%
    },
  },
});
