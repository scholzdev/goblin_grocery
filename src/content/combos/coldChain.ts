import { defineCombo } from '../../engine/define';
import { Combo, Item, Tag } from '../../engine/ids';

// Self-Checkout Laser + Ice Pack: the beam counts how many times in a row it was aimed at the same enemy (`c.state.target` / `c.state.run`); every `every`th
// freezes it (a frost-tagged stun). Aiming at someone else restarts the count. Echo beams neither count nor reset.
export default defineCombo({
  id: Combo.coldChain, requires: [Item.laser, Item.ice],
  tune: { every: 3, freeze: 0.8 },
  text: {
    en: {
      name: 'Cold Chain', short: '{every}rd beam in a row freezes',
      summary: 'Self-Checkout Laser touching an Ice Pack: keep the scan on one item.',
      detail: 'Every {every}rd beam in a row at the same enemy freezes it solid for {freeze|s}.',
    },
    de: {
      name: 'Kühlkette', short: 'Jeder {every}. Strahl in Folge friert ein',
      summary: 'Selbstscan-Laser berührt Kühlakku: halte den Scan auf einem Artikel.',
      detail: 'Jeder {every}. Strahl in Folge auf denselben Gegner friert ihn {freeze|s} lang fest.',
    },
  },
  hooks: {
    'pattern:beam'(ev, ctx, c) {
      if (ev.stage !== 'after' || ev.echo || !c.touches(ev.stats.uid)) return;
      const t = c.tune(), e = ev.target;
      c.state.run = c.state.target === e.id ? (c.state.run ?? 0) + 1 : 1;
      c.state.target = e.id;
      if (c.state.run % t.every === 0 && e.alive) {
        ctx.stun(e, t.freeze, Tag.frost);
        ctx.fx.frostBurst(e.x, e.y - 20, 6);
      }
    },
  },
});
