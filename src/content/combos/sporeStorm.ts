import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Leaf Blower + Moldy Bread: the end of every blast's cone counts as an explosion for the bread: the same spore cloud as Moldy Bread's own
// (`pattern:explode` in items/moldybread.ts), with its numbers (`tuneOf`, at its tier), centered where the cone ends.
export default defineCombo({
  id: Combo.sporeStorm, requires: [Item.leafblower, Item.moldybread],
  text: {
    en: {
      name: 'Spore Storm', short: 'Blasts seed spore clouds',
      summary: 'Leaf Blower touching Moldy Bread: the gust spreads the mold.',
      detail: 'Every blast leaves a Moldy Bread spore cloud where its cone ends: it poisons the enemies inside, as if it were an explosion.',
    },
    de: {
      name: 'Sporensturm', short: 'Böen säen Sporenwolken',
      summary: 'Laubbläser berührt Schimmelbrot: der Windstoß verbreitet den Schimmel.',
      detail: 'Jede Böe hinterlässt dort, wo ihr Kegel endet, eine Sporenwolke des Schimmelbrots: Sie vergiftet die Gegner darin, als wäre es eine Explosion.',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tuneOf(Item.moldybread, c.owned(Item.moldybread));
      const at = { x: ev.x + Math.cos(ev.angle) * ev.stats.range, y: ev.y + Math.sin(ev.angle) * ev.stats.range };
      const spores = (): void => { for (const e of ctx.inRadius(at, t.radius)) ctx.poison(e, t.dps, t.poison); };
      spores();
      ctx.fx.puff(at.x, at.y - 10, 4);
      ctx.fx.ring('fx_pulse', at.x, at.y, t.radius * 2, 420, 0x8fcb57);
      for (let s = t.tick; s < t.duration - 1e-9; s += t.tick) ctx.delay(s, () => { if (ctx.combatActive()) spores(); });
    },
  },
});
