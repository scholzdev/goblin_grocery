import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Moldy Bread: every explosion of an adjacent weapon (`pattern:explode`: the Pressure Cooker's pot) leaves a spore cloud at the blast. The cloud ticks every `tick` s for
// `duration` s and poisons whoever stands in it (`dps` for `poison` s, refreshes). A blast hit on a poisoned enemy then sets off Detonate (engine/reactions.ts).
export default defineItem({
  id: Item.moldybread, kind: 'module', sets: [Set.snacks, Set.blast], shape: '1x1', price: 12,
  tune: { dps: [2, 3, 4], radius: 70, duration: 3, tick: 0.5, poison: 2 },
  text: {
    en: { name: 'Moldy Bread', blurb: 'Still technically bread.', rules: 'Explosions of adjacent weapons leave a spore cloud (radius {radius}, {duration|s}) that poisons enemies inside: {dps|ps} for {poison|s}. The next blast hit on a poisoned enemy detonates it: Detonate.' },
    de: { name: 'Schimmelbrot', blurb: 'Technisch gesehen noch Brot.', rules: 'Explosionen der angrenzenden Waffe hinterlassen eine Sporenwolke (Radius {radius}, {duration|s}), die Gegner darin vergiftet: {dps|ps} für {poison|s}. Der nächste Explosionstreffer auf einen vergifteten Gegner lässt ihn detonieren: Detonation.' },
  },
  rows: [{ label: { en: 'Spore poison', de: 'Sporengift' }, key: 'dps', fmt: 'ps' }],
  hooks: {
    'pattern:explode'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), at = { x: ev.x, y: ev.y };
      const spores = (): void => { for (const e of ctx.inRadius(at, t.radius)) ctx.poison(e, t.dps, t.poison); };
      spores();
      ctx.fx.puff(at.x, at.y - 10, 4);
      ctx.fx.ring('fx_pulse', at.x, at.y, t.radius * 2, 420, 0x8fcb57);
      for (let s = t.tick; s < t.duration - 1e-9; s += t.tick) ctx.delay(s, () => { if (ctx.combatActive()) spores(); });
    },
  },
});
