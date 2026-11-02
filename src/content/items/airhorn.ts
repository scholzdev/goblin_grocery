import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Automatic: when `crowd` or more enemies stand within `radius` of the cart, the horn blows (up to `charges` times per aisle, `gap` s apart).
// `c.state` is fresh for every aisle, so the used charges and the gap timer need no reset.
export default defineItem({
  id: Item.airhorn, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 14,
  tune: { crowd: 8, radius: 150, charges: [1, 1, 2], gap: 2, stun: [1, 1.3, 1.5], bossStun: 0.3 }, // charges per aisle; seconds every enemy on screen is stunned (a boss only for `bossStun`)
  text: {
    en: { name: 'Air Horn', blurb: 'Subtle. Like a freight train.', rules: 'When at least {crowd} enemies are within {radius} of the cart, it blows automatically (up to {charges} per aisle): stuns every enemy on screen for {stun|s}. Bosses are stunned for only {bossStun|s}.' },
    de: { name: 'Signalhorn', blurb: 'Dezent. Wie ein Güterzug.', rules: 'Sobald mindestens {crowd} Gegner im Umkreis von {radius} um den Wagen sind, ertönt es automatisch (bis zu {charges} pro Gang): betäubt jeden Gegner im Bild für {stun|s}. Bosse nur für {bossStun|s}.' },
  },
  rows: [{ label: { en: 'Charges', de: 'Ladungen' }, key: 'charges' }, { label: { en: 'Stun', de: 'Betäubung' }, key: 'stun', fmt: 's' }],
  hooks: {
    onTick(dt, ctx, c) {
      const t = c.tune(), s = c.state;
      s.used ??= 0;
      s.cd = Math.max(0, (s.cd ?? 0) - dt);
      if (s.used >= t.charges || s.cd > 0 || ctx.inRadius(ctx.player, t.radius).length < t.crowd) return;
      s.used++;
      s.cd = t.gap;
      for (const e of ctx.alive()) ctx.stun(e, t.stun, undefined, t.bossStun);
      ctx.fx.ring('fx_pulse', ctx.player.x, ctx.player.y, 900, 500);
      ctx.fx.shake(0.006, 220);
      ctx.sound('whistle', { rate: 0.6 });
    },
  },
});
