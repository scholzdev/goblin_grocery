import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'ice', kind: 'module', sets: ['kitchen', 'frost'], shape: '1x2', price: 8, buff: 'ice',
  unlock: 'starting',
  // slow per ★ (25% base x TIER.mult), capped at `cap`: the cap only bites for Gold Star's effective ★4 (62.5%) and
  // for Jelly Beans, which reads this tune at ★1
  tune: { pct: [0.25, 0.375, 0.5], duration: 1, cap: 0.6 },
  text: {
    en: { name: 'Ice Pack', blurb: 'Chilly hits slow groceries down.', rules: 'Adjacent weapon hits slow enemies by {pct|pct} for {duration|s}. Repeated hits refresh.' },
    de: { name: 'Kühlakku', blurb: 'Eisige Treffer bremsen Gegner aus.', rules: 'Treffer der angrenzenden Waffe verlangsamen Gegner um {pct|pct} für {duration|s}. Wiederholte Treffer erneuern den Effekt.' },
  },
  rows: [{ label: { en: 'Slow', de: 'Verlangsamung' }, key: 'pct', fmt: 'pct' }],
  build: {
    phase: 'module', order: 40,
    weapon(w, c) {
      const t = c.tune();
      w.slow = { pct: Math.min(t.cap, t.pct), duration: t.duration };
    },
  },
});
