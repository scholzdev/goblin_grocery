import { defineItem, wrapAngle } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.fireextinguisher, kind: 'passive', sets: [Set.cleaning, Set.frost], shape: '1x2', price: 16,
  // automatic: every `cooldown` s it blasts the nearest enemy in range (waits while there is none); one blast = a cone of `arc` degrees and `range` px:
  // damage, a slow (`slow` fraction for `slowTime` s), a stun and a push
  tune: { cooldown: [6, 5, 4], damage: 6, arc: 70, range: 180, stun: 0.6, slow: 0.4, slowTime: 2, knockback: 200 },
  text: {
    en: { name: 'Fire Extinguisher', blurb: 'Aimed at groceries. Technically a misuse.', rules: 'Every {cooldown|s}, automatically blasts the nearest enemy: a {arc}° cone, {range} range, {damage} damage, slows, stuns for {stun|s} and knocks back.' },
    de: { name: 'Feuerlöscher', blurb: 'Auf Lebensmittel gerichtet. Streng genommen Missbrauch.', rules: 'Alle {cooldown|s} sprüht er automatisch auf den nächsten Gegner: ein {arc}°-Kegel, {range} Reichweite, {damage} Schaden, verlangsamt, betäubt {stun|s} und stößt zurück.' },
  },
  rows: [{ label: { en: 'Interval', de: 'Intervall' }, key: 'cooldown', fmt: 's' }],
  hooks: {
    // `c.state.cd` counts down from a fresh aisle's full cooldown; with nobody in range it stays at 0 and the shot goes out as soon as someone is.
    onTick(dt, ctx, c) {
      const t = c.tune(), p = ctx.player, s = c.state;
      s.cd = Math.max(0, (s.cd ?? t.cooldown) - dt);
      if (s.cd > 0) return;
      const target = ctx.nearest(p, t.range + 40);
      if (!target) return;
      s.cd = t.cooldown;
      const aim = Math.atan2(target.y - p.y, target.x - p.x);
      const half = (t.arc / 2) * Math.PI / 180;
      for (const e of ctx.inRadius(p, t.range)) {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (Math.abs(wrapAngle(Math.atan2(dy, dx) - aim)) > half && d > e.def.radius + p.radius) continue;
        ctx.damage(e, t.damage, null, { label: 'Extinguisher', quiet: true, kb: t.knockback, kbX: dx / (d || 1), kbY: dy / (d || 1) });
        if (!e.alive) continue;
        ctx.slow(e, { pct: t.slow, duration: t.slowTime });
        ctx.stun(e, t.stun);
      }
      ctx.fx.puff(p.x + Math.cos(aim) * 80, p.y - 26 + Math.sin(aim) * 80, 6);
      ctx.sound('spray', { rate: 0.8 });
    },
  },
});
