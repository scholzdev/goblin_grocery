import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Leaf Blower + Air Horn: every `every`th blast (`c.state.blasts`) is a siren blast that stuns everything it hit for `stun` s.
export default defineCombo({
  id: Combo.airRaid, requires: [Item.leafblower, Item.airhorn],
  tune: { every: 5, stun: 0.5 },
  text: {
    en: {
      name: 'Air Raid', short: 'Every {every}th blast stuns',
      summary: 'Leaf Blower touching an Air Horn: the siren pins the whole aisle.',
      detail: 'Every {every}th blast stuns all enemies it hits for {stun|s}.',
    },
    de: {
      name: 'Fliegeralarm', short: 'Jede {every}. Böe betäubt',
      summary: 'Laubbläser berührt Signalhorn: die Sirene nagelt den ganzen Gang fest.',
      detail: 'Jede {every}. Böe betäubt alle getroffenen Gegner für {stun|s}.',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune();
      c.state.blasts = (c.state.blasts ?? 0) + 1;
      if (c.state.blasts % t.every !== 0) return;
      for (const e of ev.hits) if (e.alive) ctx.stun(e, t.stun);
      ctx.fx.ring('fx_pulse', ev.x, ev.y, ev.stats.range * 2, 420);
    },
  },
});
