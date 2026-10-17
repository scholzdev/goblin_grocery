import { defineCombo } from '../../engine/define';
import { Combo, Item, Tag } from '../../engine/ids';

// Vacuum + Double Bag + Running Boots: vacuum kills charge a garbage bag (`c.state.bag`, shown as "BAG xN"); the next dash drops it and it
// explodes after `fuse` s for `dmgPerCharge` per charge. The label of the blast is the literal "Bag It".
export default defineCombo({
  id: Combo.bagIt, requires: [Item.vacuum, Item.doublebag, Item.boot],
  tune: { perKill: 1, max: 10, fuse: 0.4, radius: 120, dmgPerCharge: 6 },
  text: {
    en: {
      name: 'Bag It', short: 'Kills charge a garbage bomb',
      summary: 'Vacuum touching a Double Bag AND Running Boots: bag the trash, then toss it.',
      detail: 'Each enemy the vacuum kills adds {perKill} charge (max {max}). Dashing with charges drops a garbage bag that explodes after {fuse|s}: {dmgPerCharge} damage per charge within {radius}, with knockback. Charges reset.',
    },
    de: {
      name: 'Eingetütet', short: 'Abschüsse laden eine Müllbombe',
      summary: 'Staubsauger berührt Doppeltüte UND Rennstiefel: Müll einsacken, dann werfen.',
      detail: 'Jeder vom Staubsauger besiegte Gegner gibt {perKill} Ladung (max. {max}). Ein Dash mit Ladungen wirft einen Müllsack, der nach {fuse|s} explodiert: {dmgPerCharge} Schaden pro Ladung im Umkreis von {radius}, mit Rückstoß. Die Ladungen werden zurückgesetzt.',
    },
  },
  hooks: {
    // A credited kill by this vacuum.
    onKill(ev, ctx, c) {
      const s = ev.hit?.stats;
      if (!s || !c.touches(s.uid)) return;
      const t = c.tune();
      c.state.bag = Math.min(t.max, (c.state.bag ?? 0) + t.perKill);
      ctx.setLine(Combo.bagIt, `BAG x${c.state.bag}`, 1);
    },
    // Dashing with charges drops the bag where the goblin stands; the charges reset.
    onDashStart(_ev, ctx, c) {
      const n: number = c.state.bag ?? 0;
      if (n <= 0) return;
      const t = c.tune(), { x, y } = ctx.player;
      c.state.bag = 0;
      ctx.setLine(Combo.bagIt, null);
      ctx.fx.garbageBag(x, y, t.fuse);
      ctx.delay(t.fuse, () => {
        if (!ctx.combatActive()) return;
        ctx.fx.ring('fx_boom', x, y, t.radius * 2.4, 380);
        ctx.fx.puff(x, y - 10, 5);
        ctx.fx.shake(0.004, 110);
        ctx.sound('boom');
        for (const e of ctx.inRadius({ x, y }, t.radius)) {
          const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
          ctx.damage(e, t.dmgPerCharge * n, null, { kb: 220, kbX: dx / (d || 1), kbY: dy / (d || 1), label: 'Bag It', tags: [Tag.blast] });
        }
      });
    },
  },
});
