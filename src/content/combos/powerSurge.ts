import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Self-Checkout Laser + Power Strip: every beam fires an aftershock `delay` s later (re-aimed at the same target, or the nearest if it
// died) for `damageMult` damage. Both halves are `pattern:beam` `before`: the first beam schedules the echo, the echo sets its own damage.
export default defineCombo({
  id: Combo.powerSurge, requires: [Item.laser, Item.powerstrip],
  tune: { delay: 0.25, damageMult: 0.25 },
  text: {
    en: {
      name: 'Power Surge', short: 'Beam aftershock',
      summary: 'Self-Checkout Laser touching a Power Strip: double scan.',
      detail: 'Every beam fires an aftershock {delay|s} later for {damageMult|pct} damage.',
    },
    de: {
      name: 'Stromstoß', short: 'Strahl-Nachbeben',
      summary: 'Selbstscan-Laser berührt Steckdosenleiste: doppelter Scan.',
      detail: 'Jeder Strahl löst {delay|s} später ein Nachbeben für {damageMult|pct} Schaden aus.',
    },
  },
  hooks: {
    'pattern:beam'(ev, ctx, c) {
      if (ev.stage !== 'before' || !c.touches(ev.stats.uid)) return;
      const t = c.tune();
      if (ev.echo) { ev.damageMult = t.damageMult; return; }
      const { stats, target } = ev;
      ctx.delay(t.delay, () => {
        const next = target.alive ? target : ctx.nearest(ctx.player, stats.range);
        if (next && ctx.combatActive()) ctx.beam(stats.uid, next, true);
      });
    },
  },
});
