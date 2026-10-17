import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.bumper, kind: 'passive', sets: [Set.tools, Set.blast], shape: '1x1', price: 11,
  tune: { slam: [8, 8 * 1.5, 8 * 2], radius: 90 }, // landing blast damage per ★ (8 x TIER.mult); radius is flat
  text: {
    en: { name: 'Slam Bumper', blurb: 'Land the dash with a bang.', rules: 'The Space dash ends in a shockwave: {slam} damage within {radius} and knockback (does not stack). Enables Pot Slam next to a Pressure Cooker.' },
    de: { name: 'Rammschutz', blurb: 'Lande den Dash mit einem Knall.', rules: 'Der Leertasten-Dash endet in einer Druckwelle: {slam} Schaden im Umkreis von {radius} und Rückstoß (stapelt sich nicht). Schaltet Topf-Slam neben einem Schnellkochtopf frei.' },
  },
  rows: [{ label: { en: 'Landing blast', de: 'Landeknall' }, key: 'slam' }],
  hooks: {
    // The dash landing. Emitted first in `dashLanding`, before Pot Slam's blast (the Bumper hits first, then the pot).
    // Each enemy is knocked away from the landing point, so this loops over `inRadius` instead of using `damageArea` (one shared direction).
    onDashEnd(ev, ctx, c) {
      const { slam, radius } = c.tune();
      ctx.sound('boom', { volume: 0.5 });
      ctx.fx.ring('fx_boom', ev.x, ev.y, radius * 2, 300, 0xf5bd45);
      for (const e of ctx.inRadius(ev, radius)) {
        const dx = e.x - ev.x, dy = e.y - ev.y, d = Math.hypot(dx, dy);
        ctx.damage(e, slam, null, { kb: 200, kbX: dx / (d || 1), kbY: dy / (d || 1), label: 'Slam Bumper' });
      }
    },
  },
});
