import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Leaf Blower + Fuel Can: dry leaves. If the blast sets any enemy it hit on fire (the Fuel burn already applies, on top of any older burn), the strongest burn
// found among them (its dps and the time it has left) spreads to every enemy within `spread` of a burning one, including the ones just outside the cone.
export default defineCombo({
  id: Combo.leafPile, requires: [Item.leafblower, Item.fuel],
  tune: { spread: 80 },
  text: {
    en: {
      name: 'Leaf Pile', short: 'Blasts spread burning',
      summary: 'Leaf Blower touching a Fuel Can: a pile of dry leaves and a spark.',
      detail: 'When a blast hits a burning enemy, the strongest burn among those hit spreads to every enemy within {spread} of a burning one.',
    },
    de: {
      name: 'Laubhaufen', short: 'Böen verbreiten Feuer',
      summary: 'Laubbläser berührt Benzinkanister: ein Haufen trockenes Laub und ein Funke.',
      detail: 'Trifft eine Böe einen brennenden Gegner, breitet sich der stärkste Brand unter den Getroffenen auf jeden Gegner im Umkreis von {spread} um einen brennenden aus.',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const now = ctx.now(), burning = ev.hits.filter((e) => e.alive && e.status.burnUntil > now);
      if (!burning.length) return;
      const top = burning.reduce((a, b) => (b.status.burnDps > a.status.burnDps ? b : a));
      const burn = { dps: top.status.burnDps, duration: top.status.burnUntil - now, tick: top.status.burnTick };
      const reached = new Set(ev.hits.filter((e) => e.alive));
      for (const b of burning) for (const e of ctx.inRadius(b, c.tune().spread)) reached.add(e);
      for (const e of reached) if (e !== top) ctx.ignite(e, burn);
    },
  },
});
