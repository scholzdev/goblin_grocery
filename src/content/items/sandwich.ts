import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.sandwich, kind: 'passive', sets: [Set.snacks], shape: '2x1', price: 12,
  tune: { heal: [20, 30, 40], threshold: 0.25 },
  text: {
    en: { name: 'Emergency Sandwich', blurb: 'Break bread in case of emergency.', rules: 'Once per aisle, surviving a hit below {threshold|pct} HP restores {heal} HP automatically. Cannot save a fatal hit. Does not stack.' },
    de: { name: 'Notfall-Sandwich', blurb: 'Im Notfall Brot brechen.', rules: 'Einmal pro Gang: Überlebst du einen Treffer mit weniger als {threshold|pct} LP, heilst du automatisch {heal} LP. Rettet nicht vor tödlichen Treffern. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Emergency healing', de: 'Notfallheilung' }, key: 'heal' }],
  hooks: {
    afterPlayerHit(_ev, ctx, c) {
      if (c.state.used || ctx.run.hp <= 0 || ctx.run.hp >= ctx.run.maxHp * c.tune().threshold) return;
      c.state.used = true;
      ctx.heal(c.tune().heal);
      ctx.healFx(ctx.player.x, ctx.player.y);
      ctx.sound('buy', { rate: 1.4 });
    },
    onTick(_dt, ctx, c) { ctx.setLine(Item.sandwich, c.state.used ? null : ctx.t('tankSandwich'), 9); },
  },
});
