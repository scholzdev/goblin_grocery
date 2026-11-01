import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Fizz Cannon + Magnet: each bounce marks the next grocery, making the chain easier to finish.
export default defineCombo({
  id: Combo.magneticFizz, requires: [Item.fizz, Item.magnet],
  tune: { seconds: 2.5 },
  text: {
    en: {
      name: 'Magnetic Fizz', short: 'Bounces mark the next target',
      summary: 'Fizz Cannon touching a Magnet: every cap pulls attention to the next grocery.',
      detail: 'Each bounce marks its next target for {seconds|s}, increasing damage from all sources.',
    },
    de: {
      name: 'Magnetbrause', short: 'Abpraller markieren das nächste Ziel',
      summary: 'Sprudelkanone berührt Magnet: jeder Kronkorken zieht die Aufmerksamkeit weiter.',
      detail: 'Jeder Abpraller markiert sein nächstes Ziel für {seconds|s}; alle Quellen verursachen mehr Schaden.',
    },
  },
  hooks: {
    'pattern:bounce'(ev, ctx, c) {
      if (!ev.next || !c.touches(ev.stats.uid)) return;
      ctx.mark(ev.next, c.tune().seconds);
    },
  },
});
