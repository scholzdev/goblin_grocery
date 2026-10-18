import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';
import { isWet } from '../../engine/wet';

// Leaf Blower + Desk Fan + Battery + Ice Pack: every blast soaks everything it hits, and every `every`th blast first strikes up to `targets` enemies that were
// already Wet (nearest to the blast first) for `damageMult` x the blast damage. The strike is `quiet` with no electric tag, so it neither chains nor consumes Wet.
export default defineCombo({
  id: Combo.thunderstorm, requires: [Item.leafblower, Item.fan, Item.battery, Item.ice],
  tune: { wet: 2, every: 3, targets: 4, damageMult: 0.5 },
  text: {
    en: {
      name: 'Thunderstorm', short: 'Blasts soak, every {every}rd strikes',
      summary: 'Leaf Blower touching a Desk Fan, a Battery AND an Ice Pack: whip up a storm.',
      detail: 'Every blast leaves enemies Wet for {wet|s}. Every {every}rd blast first strikes up to {targets} enemies that were already Wet for {damageMult|pct} blast damage.',
    },
    de: {
      name: 'Gewitter', short: 'Böen durchnässen, jede {every}. blitzt',
      summary: 'Laubbläser berührt Tischventilator, Batterie UND Kühlakku: zieh ein Unwetter auf.',
      detail: 'Jede Böe macht Gegner für {wet|s} nass. Jede {every}. Böe trifft zuerst bis zu {targets} bereits nasse Gegner für {damageMult|pct} Böenschaden.',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), now = ctx.now(), st = ev.stats;
      c.state.blasts = (c.state.blasts ?? 0) + 1;
      if (c.state.blasts % t.every === 0) {
        const near = (e: { x: number; y: number }) => Math.hypot(e.x - ev.x, e.y - ev.y);
        const struck = ev.hits.filter((e) => e.alive && isWet(e.status, now)).sort((a, b) => near(a) - near(b)).slice(0, t.targets);
        for (const e of struck) {
          ctx.boltFx(e.x, e.y, false);
          ctx.damage(e, st.damage * t.damageMult, st, { quiet: true });
        }
        if (struck.length) ctx.arcFx(struck.map((e) => ({ x: e.x, y: e.y })));
      }
      for (const e of ev.hits) ctx.wet(e, t.wet);
    },
  },
});
