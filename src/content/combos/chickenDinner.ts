import { defineCombo } from '../../engine/define';

// Frying Pan + Lunchbox: every `every`th sweep (all of this combo's pans share the count, bonus sweeps included) is bigger. The count is
// `c.state.sweeps`, fresh per aisle like the arsenal's old counter. The ordinal suffix in the text ("4th") is literal.
export default defineCombo({
  id: 'chickenDinner', requires: ['pan', 'lunchbox'],
  tune: { every: 4, rangeMult: 1.4, damageMult: 2.5 },
  text: {
    en: {
      name: 'Chicken Dinner', short: 'Every {every}th sweep is huge',
      summary: 'Frying Pan touching a Lunchbox: winner winner, every {every}th sweep is a big serving.',
      detail: 'Every {every}th sweep reaches {rangeMult|pctup}% farther and deals {damageMult}x damage.',
    },
    de: {
      name: 'Hähnchen-Menü', short: 'Jeder {every}. Schwung ist riesig',
      summary: 'Bratpfanne berührt Brotdose: Winner Winner, jeder {every}. Schwung ist eine große Portion.',
      detail: 'Jeder {every}. Schwung reicht {rangeMult|pctup}% weiter und verursacht {damageMult}-fachen Schaden.',
    },
  },
  hooks: {
    'pattern:sweep'(ev, _ctx, c) {
      if (ev.stage !== 'before' || !c.touches(ev.stats.uid)) return;
      const t = c.tune();
      c.state.sweeps = (c.state.sweeps ?? 0) + 1;
      if (c.state.sweeps % t.every === 0) { ev.range *= t.rangeMult; ev.dmg *= t.damageMult; }
    },
  },
});
