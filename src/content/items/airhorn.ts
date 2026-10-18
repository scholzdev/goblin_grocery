import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.airhorn, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 14,
  tune: { charges: [1, 1, 2], stun: [1, 1.3, 1.5], bossStun: 0.3 }, // charges per aisle; seconds every enemy on screen is stunned (a boss only for `bossStun`)
  text: {
    en: { name: 'Air Horn', blurb: 'Subtle. Like a freight train.', rules: 'Active (E, {charges} per aisle): stuns every enemy on screen for {stun|s}. Bosses are stunned for only {bossStun|s}.' },
    de: { name: 'Signalhorn', blurb: 'Dezent. Wie ein Güterzug.', rules: 'Aktiv (E, {charges} pro Gang): betäubt jeden Gegner im Bild für {stun|s}. Bosse nur für {bossStun|s}.' },
  },
  rows: [{ label: { en: 'Charges', de: 'Ladungen' }, key: 'charges' }, { label: { en: 'Stun', de: 'Betäubung' }, key: 'stun', fmt: 's' }],
  active: {
    use(ctx, c) {
      const t = c.tune();
      for (const e of ctx.alive()) ctx.stun(e, t.stun, undefined, t.bossStun);
      ctx.fx.ring('fx_pulse', ctx.player.x, ctx.player.y, 900, 500);
      ctx.fx.shake(0.006, 220);
      ctx.sound('whistle', { rate: 0.6 });
    },
  },
});
